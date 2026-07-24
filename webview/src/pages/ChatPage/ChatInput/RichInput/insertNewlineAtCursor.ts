/**
 * Insert a single newline at the current caret position inside a focused
 * contentEditable, without relying on the browser's default Enter handling.
 *
 * Why explicit insertion (issue #215): under JCEF (embedded Chromium) with a
 * non-English keyboard layout, a plain Enter is frequently swallowed as an IME
 * "commit" keystroke, so the browser never inserts the line break. Deciding the
 * newline ourselves and writing it directly is layout-independent and always
 * produces exactly one `\n`.
 *
 * Two paths:
 *   1. `document.execCommand('insertLineBreak')` — the fast path. In a
 *      `plaintext-only` editable, Chromium inserts a real `\n` and fires a
 *      native `input` event so the composer's value sync runs normally.
 *   2. Manual fallback — when execCommand is unavailable (returns false) or
 *      throws (jsdom reports "not implemented"). We insert a `\n` TEXT node
 *      (not a `<br>`): the composer derives `value` from `textContent`, where a
 *      `<br>` contributes no newline and would silently drop the line break.
 *
 * Assumes the target editable is focused so `window.getSelection()` points into
 * it. No-ops safely when there is no usable selection.
 */
export function insertNewlineAtCursor(): void {
  let handledByBrowser = false;
  try {
    handledByBrowser = document.execCommand('insertLineBreak');
  } catch {
    handledByBrowser = false;
  }
  if (handledByBrowser) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const newline = document.createTextNode('\n');
  range.insertNode(newline);

  // Collapse the caret to just after the inserted newline.
  range.setStartAfter(newline);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}
