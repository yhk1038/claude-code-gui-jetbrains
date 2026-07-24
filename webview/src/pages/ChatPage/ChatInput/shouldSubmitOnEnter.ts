/**
 * Pure helper that determines whether a keydown event on the composer should
 * trigger form submission, based on the useCtrlEnterToSend setting.
 *
 * Extracted for unit-testability without requiring full context setup.
 *
 * Robustness notes (issue #215, JCEF/embedded-Chromium):
 *   - `isEnterKey` double-detects Enter via `key === 'Enter'` OR `keyCode === 13`.
 *     Non-English layouts under JCEF can surface Enter with a non-"Enter" key
 *     string but keyCode 13.
 *   - `isComposing` is expected to already be the OR of our own composition
 *     truth and `nativeEvent.isComposing` (JCEF's native flag is unreliable
 *     alone). It always guards the submit path. While a composition is in
 *     flight this blocks submit; once it ends (`isComposing` false) a plain
 *     Enter behaves normally, so typing a CJK glyph then pressing Enter submits
 *     on the first Enter just like a pasted string does.
 *
 * @param event - subset of KeyboardEvent-derived properties for the decision
 * @param useCtrlEnterToSend - value of the ClaudeSettings toggle
 * @returns true when the key combo should submit the prompt
 */
export function shouldSubmitOnEnter(
  event: {
    key: string;
    keyCode: number;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    isComposing: boolean;
    isMobile: boolean;
  },
  useCtrlEnterToSend: boolean,
): boolean {
  // Only applies to the Enter key (double-detected for non-English layouts).
  const isEnterKey = event.key === 'Enter' || event.keyCode === 13;
  if (!isEnterKey) return false;

  // IME composition and mobile are always guarded on the submit path.
  if (event.isComposing || event.isMobile) return false;

  if (useCtrlEnterToSend) {
    // Ctrl/Cmd+Enter sends; Shift+Enter and plain Enter insert newlines.
    return (event.ctrlKey || event.metaKey) && !event.shiftKey;
  } else {
    // Default: Enter sends, Shift+Enter inserts a newline.
    if (event.shiftKey) return false;
    return true;
  }
}
