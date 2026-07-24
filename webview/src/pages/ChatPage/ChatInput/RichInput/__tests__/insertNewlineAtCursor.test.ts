/**
 * Tests for insertNewlineAtCursor.
 *
 * jsdom does not implement `document.execCommand`, so we exercise both paths:
 *   - execCommand present and succeeding (mocked to return true): the util
 *     defers to the browser and inserts nothing itself.
 *   - execCommand absent/failing: the manual fallback inserts a real "\n" text
 *     node at the caret. We insert a text node (not a <br>) because our composer
 *     derives its value from `textContent`, where a <br> would contribute no
 *     newline and silently drop the line break from `value`.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { insertNewlineAtCursor } from '../insertNewlineAtCursor';

// jsdom does not implement document.execCommand at all (the property is absent),
// so vi.spyOn cannot attach to it. We assign a stub directly per test and remove
// it afterwards. The shape cast keeps the delete type-safe without `any`.
type ExecCommandHost = { execCommand?: Document['execCommand'] };
function setExecCommand(fn: Document['execCommand']): void {
  (document as ExecCommandHost).execCommand = fn;
}
function clearExecCommand(): void {
  delete (document as ExecCommandHost).execCommand;
}

function makeEditableWithCaret(text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = text;
  document.body.appendChild(el);

  const sel = window.getSelection()!;
  const range = document.createRange();
  const textNode = el.firstChild ?? el;
  // Place the caret at the end of the text.
  range.setStart(textNode, textNode.nodeType === Node.TEXT_NODE ? (textNode as Text).length : 0);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  return el;
}

describe('insertNewlineAtCursor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    clearExecCommand();
    vi.restoreAllMocks();
  });

  it('defers to execCommand when it succeeds (inserts nothing itself)', () => {
    const el = makeEditableWithCaret('hello');
    const exec = vi.fn().mockReturnValue(true);
    setExecCommand(exec as unknown as Document['execCommand']);

    insertNewlineAtCursor();

    expect(exec).toHaveBeenCalledWith('insertLineBreak');
    // No manual fallback ran, so the DOM text is unchanged by the util.
    expect(el.textContent).toBe('hello');
  });

  it('falls back to inserting a "\\n" text node when execCommand returns false', () => {
    const el = makeEditableWithCaret('hello');
    setExecCommand(vi.fn().mockReturnValue(false) as unknown as Document['execCommand']);

    insertNewlineAtCursor();

    expect(el.textContent).toBe('hello\n');
  });

  it('falls back gracefully when execCommand throws (jsdom "not implemented")', () => {
    const el = makeEditableWithCaret('world');
    setExecCommand((() => {
      throw new Error('not implemented');
    }) as unknown as Document['execCommand']);

    expect(() => insertNewlineAtCursor()).not.toThrow();
    expect(el.textContent).toBe('world\n');
  });

  it('is a no-op-safe when execCommand is entirely absent (fallback runs)', () => {
    const el = makeEditableWithCaret('bye');
    clearExecCommand(); // simulate real jsdom: no execCommand at all

    expect(() => insertNewlineAtCursor()).not.toThrow();
    expect(el.textContent).toBe('bye\n');
  });

  it('inserts the newline at the caret between existing characters', () => {
    const el = document.createElement('div');
    el.textContent = 'abcd';
    document.body.appendChild(el);
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(el.firstChild as Text, 2); // caret between "ab" and "cd"
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    setExecCommand(vi.fn().mockReturnValue(false) as unknown as Document['execCommand']);
    insertNewlineAtCursor();

    expect(el.textContent).toBe('ab\ncd');
  });
});
