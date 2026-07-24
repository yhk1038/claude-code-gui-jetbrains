/**
 * Tests for ChatInput keyboard submit behavior.
 *
 * Strategy: rather than mocking the full context tree (ChatInputFocusContext,
 * SessionContext, ChatStreamContext, ClaudeSettingsContext, etc.) which would
 * exceed ~50 lines of setup, the key-handling decision is extracted into the
 * pure helper `shouldSubmitOnEnter`. These tests cover the helper directly,
 * which is the single source of truth for the submit/newline branching logic.
 */

import { describe, it, expect } from 'vitest';
import { shouldSubmitOnEnter } from '../ChatInput/shouldSubmitOnEnter';

const makeEvent = (overrides: Partial<{
  key: string;
  keyCode: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  isComposing: boolean;
  isMobile: boolean;
}> = {}) => ({
  key: 'Enter',
  keyCode: 13,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  isComposing: false,
  isMobile: false,
  ...overrides,
});

describe('shouldSubmitOnEnter — useCtrlEnterToSend: false (default mode)', () => {
  it('Enter (no modifier) → submit called', () => {
    expect(shouldSubmitOnEnter(makeEvent(), false)).toBe(true);
  });

  it('Shift+Enter → submit NOT called', () => {
    expect(shouldSubmitOnEnter(makeEvent({ shiftKey: true }), false)).toBe(false);
  });

  it('Ctrl+Enter → submit called (Ctrl is not treated as newline in default mode)', () => {
    // In default mode, the only guard is shiftKey. Ctrl+Enter still submits.
    expect(shouldSubmitOnEnter(makeEvent({ ctrlKey: true }), false)).toBe(true);
  });

  it('IME composing → submit NOT called', () => {
    expect(shouldSubmitOnEnter(makeEvent({ isComposing: true }), false)).toBe(false);
  });

  it('Enter right after a composition ends (isComposing false) → submit called', () => {
    // Regression guard: typing a CJK glyph then pressing Enter must submit on the
    // FIRST Enter. The composition is already finished (isComposing=false), so no
    // recent-composition suppression should swallow this Enter as a newline.
    // (A prior `isRecentlyComposing` guard caused a spurious first-Enter newline.)
    expect(shouldSubmitOnEnter(makeEvent({ isComposing: false }), false)).toBe(true);
  });

  it('mobile environment → submit NOT called', () => {
    expect(shouldSubmitOnEnter(makeEvent({ isMobile: true }), false)).toBe(false);
  });
});

describe('shouldSubmitOnEnter — useCtrlEnterToSend: true', () => {
  it('Enter (no modifier) → submit NOT called (newline allowed)', () => {
    expect(shouldSubmitOnEnter(makeEvent(), true)).toBe(false);
  });

  it('Shift+Enter → submit NOT called', () => {
    expect(shouldSubmitOnEnter(makeEvent({ shiftKey: true }), true)).toBe(false);
  });

  it('Ctrl+Enter → submit called', () => {
    expect(shouldSubmitOnEnter(makeEvent({ ctrlKey: true }), true)).toBe(true);
  });

  it('Cmd+Enter (metaKey) → submit called', () => {
    expect(shouldSubmitOnEnter(makeEvent({ metaKey: true }), true)).toBe(true);
  });

  it('Ctrl+Shift+Enter → submit NOT called (Shift prevents submit)', () => {
    expect(shouldSubmitOnEnter(makeEvent({ ctrlKey: true, shiftKey: true }), true)).toBe(false);
  });

  it('IME composing + Ctrl+Enter → submit NOT called', () => {
    expect(shouldSubmitOnEnter(makeEvent({ ctrlKey: true, isComposing: true }), true)).toBe(false);
  });

  it('mobile + Ctrl+Enter → submit NOT called', () => {
    expect(shouldSubmitOnEnter(makeEvent({ ctrlKey: true, isMobile: true }), true)).toBe(false);
  });
});

describe('shouldSubmitOnEnter — non-Enter key', () => {
  it('non-Enter key always returns false regardless of mode', () => {
    // key !== 'Enter' AND keyCode !== 13
    expect(shouldSubmitOnEnter(makeEvent({ key: 'a', keyCode: 65 }), false)).toBe(false);
    expect(shouldSubmitOnEnter(makeEvent({ key: 'a', keyCode: 65 }), true)).toBe(false);
  });
});

describe('shouldSubmitOnEnter — isEnterKey double detection (keyCode 13)', () => {
  it('keyCode 13 with non-Enter key string still counts as Enter (non-English layout)', () => {
    // Non-English layouts under JCEF may surface Enter with a stale/non-"Enter"
    // key string but keyCode 13. Submit path must still recognize it.
    expect(shouldSubmitOnEnter(makeEvent({ key: 'Process', keyCode: 13 }), false)).toBe(true);
  });

  it('key "Enter" with keyCode 0 still counts as Enter', () => {
    expect(shouldSubmitOnEnter(makeEvent({ key: 'Enter', keyCode: 0 }), false)).toBe(true);
  });
});
