import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
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
  'w-full px-3 text-base leading-normal',
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

  // Live display text that drives the mirror. Unlike `value` (the controlled
  // prop, which is NOT updated mid-IME-composition), this tracks the editable
  // div's textContent on every keystroke AND every composition update, so the
  // mirror paints in-progress glyphs in real time. Without this the transparent
  // editable glyphs would vanish during composition and the visible text would
  // appear to lag one character behind.
  const [displayText, setDisplayText] = useState(value);

  // Expose the editable div to the parent (focus / domSelection utilities) while
  // keeping our own internal ref for sync work.
  useImperativeHandle(ref, () => elRef.current as HTMLDivElement, []);

  // value → DOM sync. Only writes when the DOM diverges from `value` (prevents
  // caret jumps on every keystroke) and never during IME composition.
  useLayoutEffect(() => {
    const el = elRef.current;
    if (el === null) return;
    // While composing, leave both the DOM and displayText untouched so the
    // in-progress glyphs (driven by composition events) are never clobbered.
    if (isComposingRef.current) return;

    const current = el.textContent ?? '';
    if (current === value) {
      // An empty value can still leave a stray <br>/empty node behind (e.g.
      // after clearing an IME composition), which defeats `:empty` and hides
      // the placeholder. Force a real empty node so the placeholder shows.
      if (value === '' && el.childNodes.length > 0) {
        el.textContent = '';
      }
      // DOM already matches; still reconcile displayText so an external value
      // change that equals the live text (rare) doesn't leave a stale mirror.
      if (displayText !== value) setDisplayText(value);
      return;
    }

    el.textContent = value;
    // External value changes (submit/clear/Alt+K insert) must repaint the
    // mirror to match the freshly written DOM.
    setDisplayText(value);

    // Only reposition the caret when this element is focused, so background
    // (programmatic) updates don't steal the selection from elsewhere.
    if (document.activeElement === el) {
      setCaretOffset(el, value.length);
    }
  }, [value, displayText]);

  const handleInput = useCallback(
    (e: FormEvent<HTMLDivElement>) => {
      const text = e.currentTarget.textContent ?? '';
      // Always repaint the mirror in real time, including mid-composition.
      setDisplayText(text);
      // During composition the intermediate text is not yet committed; defer
      // reporting to the parent until compositionend to avoid emitting partial
      // glyphs. The mirror still updates above so the user sees live feedback.
      if (isComposingRef.current) return;
      onChange(text);
    },
    [onChange],
  );

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionUpdate = useCallback(
    (e: ReactCompositionEvent<HTMLDivElement>) => {
      // Repaint the mirror on every composition update so the in-progress
      // glyphs track the caret without lagging a character behind.
      setDisplayText(e.currentTarget.textContent ?? '');
    },
    [],
  );

  const handleCompositionEnd = useCallback(
    (e: ReactCompositionEvent<HTMLDivElement>) => {
      isComposingRef.current = false;
      const text = e.currentTarget.textContent ?? '';
      setDisplayText(text);
      onChange(text);
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

  // The mirror paints `displayText` (live, includes in-progress IME glyphs),
  // NOT `value` (which lags during composition).
  const segments = splitIntoSegments(displayText, highlightTokens);
  // A trailing newline collapses on the last line of a wrapping box; append a
  // zero-content newline so the mirror's height matches the editable div.
  const trailingNewline = displayText.endsWith('\n');

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
        onCompositionUpdate={handleCompositionUpdate}
        onCompositionEnd={handleCompositionEnd}
      />
    </div>
  );
});

RichInput.displayName = 'RichInput';
