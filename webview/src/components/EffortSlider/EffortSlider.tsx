import { useRef, type PointerEvent } from 'react';
import { useEffort } from '@/hooks/useEffort';
import { buildEffortLevels } from '@/types/effort';

interface Props {
  className?: string;
}

// Track geometry shared by the thumb/fill/notch position math (mirrors the
// CSS custom properties in index.css so the inline calc() stays in sync).
const SPAN = '(100% - var(--thumb-size) - 2 * var(--thumb-inset))';

/**
 * Effort level slider, ported from the Claude Code (Cursor) extension's
 * effort toggle (its `g$` component). A horizontal track with one notch per
 * level and a draggable thumb; clicking or dragging picks a level by
 * position. Levels come from {@link buildEffortLevels} — `[auto, …supported]` —
 * so `auto` is the leftmost stop. The ultracode step is intentionally omitted
 * (we don't wire up the workflows flag it depends on).
 *
 * Returns null when the current model doesn't support effort, so callers can
 * drop it in unconditionally.
 */
export function EffortSlider(props: Props) {
  const { className } = props;
  const { supportsEffort, levels: supported, current, setLevel } = useEffort();
  // Tracks the level index the active drag last applied, so pointermove only
  // writes settings when the index actually changes.
  const dragIndexRef = useRef<number | undefined>(undefined);

  if (!supportsEffort) return null;

  const levels = buildEffortLevels(supported);
  const count = levels.length;
  const currentIndex = Math.max(0, levels.findIndex((l) => l.key === current));
  const ratio = count > 1 ? currentIndex / (count - 1) : 0;

  const thumbLeft = `calc(var(--thumb-inset) + ${ratio} * ${SPAN})`;
  const fillWidth = `calc(var(--thumb-inset) + ${ratio} * ${SPAN} + var(--thumb-size) + var(--thumb-inset))`;
  const notchLeft = (r: number) =>
    `calc(var(--thumb-inset) + ${r} * ${SPAN} + var(--thumb-size) / 2)`;

  const indexFromEvent = (e: PointerEvent<HTMLButtonElement>) => {
    if (count <= 1) return 0;
    const rect = e.currentTarget.getBoundingClientRect();
    const r = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return Math.round(r * (count - 1));
  };

  const applyIndex = (i: number) => {
    const level = levels[i];
    if (level) setLevel(level.key);
  };

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const i = indexFromEvent(e);
    dragIndexRef.current = i;
    applyIndex(i);
  };

  const handlePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (dragIndexRef.current === undefined) return;
    const i = indexFromEvent(e);
    if (i === dragIndexRef.current) return;
    dragIndexRef.current = i;
    applyIndex(i);
  };

  const endDrag = () => {
    dragIndexRef.current = undefined;
  };

  return (
    <button
      type="button"
      className={className ? `effort-slider ${className}` : 'effort-slider'}
      title="Click or drag to set effort level"
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      // Stop the click from bubbling to a parent row handler (the slash-command
      // row's onClick cycles effort) — the slider already applied the level.
      onClick={(e) => e.stopPropagation()}
    >
      <span className="effort-slider__fill" style={{ width: fillWidth }} />
      {levels.map((level, i) => {
        const r = count > 1 ? i / (count - 1) : 0;
        return (
          <span
            key={level.key}
            className="effort-slider__notch"
            style={{ left: notchLeft(r) }}
          />
        );
      })}
      <span className="effort-slider__thumb" style={{ left: thumbLeft }} />
    </button>
  );
}
