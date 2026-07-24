/**
 * Tests for useIMEComposition — the ref-only source of truth for IME state.
 *
 * Why ref-only: under JCEF (embedded Chromium) `KeyboardEvent.isComposing` is
 * unreliable (false during an active composition, true just after it ends). We
 * therefore track composition ourselves. State is kept in refs (not React
 * state) so that fast Hangul typing never triggers a re-render mid-composition,
 * which under JCEF causes duplicated/stuttered glyphs.
 *
 * These tests assert the synchronous transitions and the 100ms fallback that
 * guarantees the flag cannot get stuck true when an IME abandons a composition
 * without a trailing input/compositionend event.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIMEComposition } from '../useIMEComposition';

describe('useIMEComposition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('compositionStart sets isComposing true synchronously', () => {
    const { result } = renderHook(() => useIMEComposition());
    expect(result.current.isComposing()).toBe(false);
    result.current.handleCompositionStart();
    expect(result.current.isComposing()).toBe(true);
  });

  it('compositionEnd sets isComposing false synchronously (no RAF/timer needed)', () => {
    const { result } = renderHook(() => useIMEComposition());
    result.current.handleCompositionStart();
    result.current.handleCompositionEnd();
    // Synchronous: must be false immediately, without advancing timers.
    expect(result.current.isComposing()).toBe(false);
  });

  it('keyCode 229 keydown is treated as a composing signal', () => {
    const { result } = renderHook(() => useIMEComposition());
    result.current.noteKeyDown(229);
    expect(result.current.isComposing()).toBe(true);
  });

  it('a non-229 keydown does not flip the composing flag', () => {
    const { result } = renderHook(() => useIMEComposition());
    result.current.noteKeyDown(13);
    expect(result.current.isComposing()).toBe(false);
  });

  it('fallback resets a stuck 229 composing flag after 100ms (abandoned composition)', () => {
    const { result } = renderHook(() => useIMEComposition());
    result.current.noteKeyDown(229);
    expect(result.current.isComposing()).toBe(true);
    // No compositionend / input arrives (IME cancel edge case).
    vi.advanceTimersByTime(100);
    expect(result.current.isComposing()).toBe(false);
  });

  it('compositionStart cancels a pending fallback so a fast next syllable is not reset', () => {
    const { result } = renderHook(() => useIMEComposition());
    result.current.handleCompositionStart();
    result.current.handleCompositionEnd(); // schedules a 100ms fallback
    // A new syllable begins within the fallback window.
    result.current.handleCompositionStart();
    expect(result.current.isComposing()).toBe(true);
    vi.advanceTimersByTime(100);
    // The stale fallback must NOT have reset the now-active composition.
    expect(result.current.isComposing()).toBe(true);
  });

  it('notifyInput cancels a pending 229 fallback (committed input resolves state)', () => {
    const { result } = renderHook(() => useIMEComposition());
    result.current.noteKeyDown(229); // composing + schedules fallback
    result.current.handleCompositionStart(); // real composition confirmed
    result.current.notifyInput(); // committed input arrives
    vi.advanceTimersByTime(100);
    // Still composing because compositionEnd has not fired; the fallback was
    // cancelled by the committed input rather than wrongly resetting state.
    expect(result.current.isComposing()).toBe(true);
  });
});
