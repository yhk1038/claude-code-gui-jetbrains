/**
 * Tests for RichInput — a contentEditable="plaintext-only" drop-in replacement
 * for the composer <textarea>.
 *
 * jsdom has no real Selection/Range layout engine, so caret-position assertions
 * are limited. These tests focus on the contract that does work under jsdom:
 *   - value → textContent rendering
 *   - user input (input event) → onChange(textContent)
 *   - external value change → DOM textContent sync (only when differing)
 *   - placeholder / disabled / aria-label attributes
 *   - event delegation (keydown / paste / focus / blur)
 *   - IME guard: composition-in-progress value change must not overwrite DOM
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRef } from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { RichInput } from '../index';

afterEach(() => cleanup());

/**
 * Simulate a user typing: jsdom doesn't update textContent from key events for
 * contentEditable, so the test writes textContent directly then fires `input`,
 * mirroring how a browser would surface a content mutation.
 */
function typeInto(el: HTMLElement, text: string) {
  el.textContent = text;
  fireEvent.input(el);
}

describe('RichInput — rendering', () => {
  it('renders value as textContent', () => {
    const { getByRole } = render(<RichInput value="hello" onChange={() => {}} />);
    const el = getByRole('textbox');
    expect(el.textContent).toBe('hello');
  });

  it('uses contentEditable=plaintext-only when enabled', () => {
    const { getByRole } = render(<RichInput value="" onChange={() => {}} />);
    const el = getByRole('textbox');
    expect(el.getAttribute('contenteditable')).toBe('plaintext-only');
  });

  it('exposes placeholder via data-placeholder', () => {
    const { getByRole } = render(
      <RichInput value="" onChange={() => {}} placeholder="Type here" />,
    );
    const el = getByRole('textbox');
    expect(el.getAttribute('data-placeholder')).toBe('Type here');
  });

  it('renders aria-label', () => {
    const { getByRole } = render(
      <RichInput value="" onChange={() => {}} ariaLabel="Message input" />,
    );
    expect(getByRole('textbox').getAttribute('aria-label')).toBe('Message input');
  });

  it('sets spellcheck=false', () => {
    const { getByRole } = render(<RichInput value="" onChange={() => {}} />);
    expect(getByRole('textbox').getAttribute('spellcheck')).toBe('false');
  });

  it('disables editing when disabled', () => {
    const { getByRole } = render(
      <RichInput value="x" onChange={() => {}} disabled />,
    );
    const el = getByRole('textbox');
    expect(el.getAttribute('contenteditable')).toBe('false');
  });

  it('applies className', () => {
    const { getByRole } = render(
      <RichInput value="" onChange={() => {}} className="custom-class" />,
    );
    expect(getByRole('textbox').className).toContain('custom-class');
  });

  it('forwards a ref to the editable div', () => {
    const ref = createRef<HTMLDivElement>();
    render(<RichInput ref={ref} value="" onChange={() => {}} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.getAttribute('role')).toBe('textbox');
  });
});

describe('RichInput — onChange', () => {
  it('calls onChange with textContent on input', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<RichInput value="" onChange={onChange} />);
    const el = getByRole('textbox');
    typeInto(el, 'abc');
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('reports empty string when content is cleared', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<RichInput value="x" onChange={onChange} />);
    const el = getByRole('textbox');
    typeInto(el, '');
    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('RichInput — external value sync', () => {
  it('updates DOM textContent when value prop changes externally', () => {
    const { getByRole, rerender } = render(
      <RichInput value="one" onChange={() => {}} />,
    );
    const el = getByRole('textbox');
    expect(el.textContent).toBe('one');

    rerender(<RichInput value="two" onChange={() => {}} />);
    expect(el.textContent).toBe('two');
  });

  it('does not touch DOM when value already matches textContent', () => {
    const { getByRole, rerender } = render(
      <RichInput value="same" onChange={() => {}} />,
    );
    const el = getByRole('textbox');
    // Simulate user already having this exact text in the node.
    const setterSpy = vi.spyOn(el, 'textContent', 'set');
    rerender(<RichInput value="same" onChange={() => {}} />);
    expect(setterSpy).not.toHaveBeenCalled();
    setterSpy.mockRestore();
  });

  it('clears textContent when value becomes empty', () => {
    const { getByRole, rerender } = render(
      <RichInput value="text" onChange={() => {}} />,
    );
    const el = getByRole('textbox');
    rerender(<RichInput value="" onChange={() => {}} />);
    expect(el.textContent).toBe('');
  });
});

describe('RichInput — event delegation', () => {
  it('delegates onKeyDown', () => {
    const onKeyDown = vi.fn();
    const { getByRole } = render(
      <RichInput value="" onChange={() => {}} onKeyDown={onKeyDown} />,
    );
    fireEvent.keyDown(getByRole('textbox'), { key: 'Enter' });
    expect(onKeyDown).toHaveBeenCalled();
  });

  it('delegates onPaste', () => {
    const onPaste = vi.fn();
    const { getByRole } = render(
      <RichInput value="" onChange={() => {}} onPaste={onPaste} />,
    );
    fireEvent.paste(getByRole('textbox'));
    expect(onPaste).toHaveBeenCalled();
  });

  it('delegates onFocus', () => {
    const onFocus = vi.fn();
    const { getByRole } = render(
      <RichInput value="" onChange={() => {}} onFocus={onFocus} />,
    );
    fireEvent.focus(getByRole('textbox'));
    expect(onFocus).toHaveBeenCalled();
  });

  it('delegates onBlur', () => {
    const onBlur = vi.fn();
    const { getByRole } = render(
      <RichInput value="" onChange={() => {}} onBlur={onBlur} />,
    );
    fireEvent.blur(getByRole('textbox'));
    expect(onBlur).toHaveBeenCalled();
  });
});

describe('RichInput — mirror overlay / chips', () => {
  it('renders an aria-hidden mirror overlay alongside the editable div', () => {
    const { container } = render(<RichInput value="hello" onChange={() => {}} />);
    const mirror = container.querySelector('.richInputMirror');
    expect(mirror).not.toBeNull();
    expect(mirror?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders no chips when highlightTokens is empty', () => {
    const { container } = render(
      <RichInput value="src/file.ts hello" onChange={() => {}} />,
    );
    expect(container.querySelectorAll('.richInputChip').length).toBe(0);
  });

  it('wraps a known token in a chip span inside the mirror', () => {
    const { container } = render(
      <RichInput
        value="see src/file.ts#L10-L25 now"
        onChange={() => {}}
        highlightTokens={['src/file.ts#L10-L25']}
      />,
    );
    const chips = container.querySelectorAll('.richInputChip');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toBe('src/file.ts#L10-L25');
  });

  it('does not chip arbitrary text that is not a known token', () => {
    const { container } = render(
      <RichInput value="this is src/other.ts" onChange={() => {}} highlightTokens={['src/file.ts']} />,
    );
    expect(container.querySelectorAll('.richInputChip').length).toBe(0);
  });

  it('renders a chip for every occurrence of a repeated token', () => {
    const { container } = render(
      <RichInput value="a.ts and a.ts" onChange={() => {}} highlightTokens={['a.ts']} />,
    );
    expect(container.querySelectorAll('.richInputChip').length).toBe(2);
  });

  it('keeps the editable textbox reachable (mirror is aria-hidden)', () => {
    const { getByRole } = render(
      <RichInput value="src/file.ts" onChange={() => {}} highlightTokens={['src/file.ts']} />,
    );
    // getByRole ignores aria-hidden mirror — the textbox is the editable div.
    expect(getByRole('textbox').textContent).toBe('src/file.ts');
  });
});

describe('RichInput — IME composition guard', () => {
  it('does not overwrite DOM textContent while composition is active', () => {
    const { getByRole, rerender } = render(
      <RichInput value="" onChange={() => {}} />,
    );
    const el = getByRole('textbox');

    // User begins IME composition; the live DOM holds the in-progress text.
    fireEvent.compositionStart(el);
    el.textContent = '한';

    // A value prop update arrives mid-composition (e.g. stale parent state).
    rerender(<RichInput value="" onChange={() => {}} />);

    // The composing text must survive — sync is skipped during composition.
    expect(el.textContent).toBe('한');
  });

  it('calls onChange with final text on compositionend', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<RichInput value="" onChange={onChange} />);
    const el = getByRole('textbox');

    fireEvent.compositionStart(el);
    el.textContent = '한글';
    fireEvent.compositionEnd(el);

    expect(onChange).toHaveBeenLastCalledWith('한글');
  });
});
