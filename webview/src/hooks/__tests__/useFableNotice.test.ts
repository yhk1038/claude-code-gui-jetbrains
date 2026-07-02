import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFableNotice, FABLE_NOTICE_DISMISSED_KEY } from '../useFableNotice';

describe('useFableNotice', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is visible during the promo window when not dismissed', () => {
    vi.setSystemTime(new Date('2026-07-03T00:00:00Z'));
    const { result } = renderHook(() => useFableNotice());
    expect(result.current.visible).toBe(true);
  });

  it('is hidden after the promo window ends', () => {
    vi.setSystemTime(new Date('2026-07-08T00:00:00Z'));
    const { result } = renderHook(() => useFableNotice());
    expect(result.current.visible).toBe(false);
  });

  it('hides and persists the dismissal once dismissed', () => {
    vi.setSystemTime(new Date('2026-07-03T00:00:00Z'));
    const { result } = renderHook(() => useFableNotice());
    act(() => result.current.dismiss());
    expect(result.current.visible).toBe(false);
    expect(localStorage.getItem(FABLE_NOTICE_DISMISSED_KEY)).toBe('1');
  });

  it('stays hidden on remount when previously dismissed', () => {
    vi.setSystemTime(new Date('2026-07-03T00:00:00Z'));
    localStorage.setItem(FABLE_NOTICE_DISMISSED_KEY, '1');
    const { result } = renderHook(() => useFableNotice());
    expect(result.current.visible).toBe(false);
  });
});
