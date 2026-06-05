import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ClipboardEvent as ReactClipboardEvent,
  type CompositionEvent as ReactCompositionEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type UIEvent as ReactUIEvent,
} from 'react';
import { setCaretOffset } from '@/utils/domSelection';
import { splitIntoSegments } from './segments';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (e: ReactClipboardEvent<HTMLDivElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  /**
   * Path tokens (e.g. `src/file.ts#L10-L25`) to highlight as chips in the
   * mirror overlay. Only exact, known tokens are highlighted — arbitrary text
   * is never chipped. Defaults to an empty list (plain text, no chips).
   */
  highlightTokens?: readonly string[];
}

/**
 * Layout classes shared by the editable div and the mirror overlay. The two
 * layers MUST agree on font, padding, line-height and wrapping so the visible
 * (mirror) glyphs land exactly under the (transparent) editable glyphs and the
 * caret. Keep this list the single source of truth for both layers.
 */
const LAYOUT_CLASSES = [
  'w-full px-3 text-base',
  'whitespace-pre-wrap break-words',
] as const;

/**
 * RichInput — a `contentEditable="plaintext-only"` div that behaves like a
 * controlled <textarea> for plain text, with a non-interactive mirror overlay
 * that paints the same text and wraps known path tokens in highlight chips.
 *
 * Two-layer composition (mirrors the Claude Code extension composer):
 *   - The editable div holds the real text + caret but renders its glyphs
 *     transparent (`richInputEditable`: color:transparent, caret-color visible),
 *     sitting on top (z-10) so typing / selection / IME all behave normally.
 *   - The mirror div (`richInputMirror`, aria-hidden, pointer-events:none) sits
 *     behind it and paints the visible text: plain runs as text, known tokens
 *     as chip spans. It shares {@link LAYOUT_CLASSES} so glyphs align exactly.
 *
 * Editing always happens in the plaintext editable div, so caret-offset math
 * (mentions, slash, history, Cmd+Arrow) is unchanged — the mirror is display
 * only. Scroll position is synced from the editable div to the mirror.
 *
 * value ↔ textContent sync rule: the editable DOM is only rewritten when it
 * actually diverges from `value`, so user typing never triggers a caret-jumping
 * reset. External (programmatic) value changes move the caret to the end. While
 * an IME composition is in flight the sync is skipped so the in-progress glyphs
 * are never clobbered.
 */
export const RichInput = forwardRef<HTMLDivElement, Props>((props: Props, ref) => {
  const {
    value,
    onChange,
    onKeyDown,
    onPaste,
    onFocus,
    onBlur,
    placeholder,
    disabled = false,
    className,
    ariaLabel,
    highlightTokens = [],
  } = props;

  const elRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);

  // Expose the editable div to the parent (focus / domSelection utilities) while
  // keeping our own internal ref for sync work.
  useImperativeHandle(ref, () => elRef.current as HTMLDivElement, []);

  // value → DOM sync. Only writes when the DOM diverges from `value` (prevents
  // caret jumps on every keystroke) and never during IME composition.
  useLayoutEffect(() => {
    const el = elRef.current;
    if (el === null) return;
    if (isComposingRef.current) return;

    const current = el.textContent ?? '';
    if (current === value) return;

    el.textContent = value;

    // Only reposition the caret when this element is focused, so background
    // (programmatic) updates don't steal the selection from elsewhere.
    if (document.activeElement === el) {
      setCaretOffset(el, value.length);
    }
  }, [value]);

  const handleInput = useCallback(
    (e: FormEvent<HTMLDivElement>) => {
      // During composition the intermediate text is not yet committed; defer
      // reporting until compositionend to avoid emitting partial glyphs.
      if (isComposingRef.current) return;
      onChange(e.currentTarget.textContent ?? '');
    },
    [onChange],
  );

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(
    (e: ReactCompositionEvent<HTMLDivElement>) => {
      isComposingRef.current = false;
      onChange(e.currentTarget.textContent ?? '');
    },
    [onChange],
  );

  // Keep the mirror's scroll position locked to the editable div so long /
  // multi-line input stays glyph-aligned while scrolling.
  const handleScroll = useCallback((e: ReactUIEvent<HTMLDivElement>) => {
    const mirror = mirrorRef.current;
    if (!mirror) return;
    mirror.scrollTop = e.currentTarget.scrollTop;
    mirror.scrollLeft = e.currentTarget.scrollLeft;
  }, []);

  const segments = splitIntoSegments(value, highlightTokens);
  // A trailing newline collapses on the last line of a wrapping box; append a
  // zero-content newline so the mirror's height matches the editable div.
  const trailingNewline = value.endsWith('\n');

  return (
    <div className="relative">
      {/* Mirror overlay — paints visible text + chips behind the editable div. */}
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className={[
          'richInputMirror',
          'absolute inset-0 pointer-events-none',
          'min-h-[20px] max-h-[200px] overflow-hidden',
          ...LAYOUT_CLASSES,
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {segments.map((seg, i) =>
          seg.isToken ? (
            <span key={i} className="richInputChip">
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
        {trailingNewline && '\n'}
      </div>

      {/* Editable div — real text + caret, glyphs transparent (see CSS). */}
      <div
        ref={elRef}
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        contentEditable={disabled ? false : 'plaintext-only'}
        spellCheck={false}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className={[
          'richInputEditable',
          'relative z-10 cursor-text bg-transparent',
          'min-h-[20px] max-h-[200px] overflow-y-auto',
          'focus:outline-none',
          ...LAYOUT_CLASSES,
          disabled ? 'opacity-50' : '',
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
        onInput={handleInput}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onFocus={onFocus}
        onBlur={onBlur}
        onScroll={handleScroll}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
      />
    </div>
  );
});

RichInput.displayName = 'RichInput';
