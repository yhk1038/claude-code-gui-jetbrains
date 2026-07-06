/**
 * Smoothly interpolates the live thinking-token estimate so the count animates
 * up instead of jumping in coarse steps.
 *
 * The CLI emits the estimate on `{type:"system", subtype:"thinking_tokens"}`
 * events in large increments (observed sequence e.g. 100 → 250). Showing that
 * value verbatim looks jerky. This tween (ported 1:1 from the Claude Code
 * Cursor/VSCode extension) eases the displayed number from its current value to
 * each new target over a duration derived from how often updates arrive, so the
 * digits scroll continuously — matching the extension exactly.
 *
 * Time is passed in explicitly (never read from a clock here) so the tween is
 * pure and unit-testable; the React hook that drives it supplies `Date.now()`.
 */

/** Minimum tween duration (ms). Fast updates still take at least this long. */
export const TWEEN_MIN_MS = 300;
/** Maximum tween duration (ms). Sparse updates are capped so they don't crawl. */
export const TWEEN_MAX_MS = 3000;
/** Duration (ms) used for the very first target (0 → first estimate). */
export const TWEEN_FIRST_MS = 1200;

export interface ThinkingTokenTweener {
  /** Advance the target to `value` as observed at `now` (ms epoch). */
  update(value: number | undefined, now: number): void;
  /** The interpolated value at `now` (ms epoch); undefined before the first target. */
  valueAt(now: number): number | undefined;
}

export function createThinkingTokenTweener(): ThinkingTokenTweener {
  let target: number | undefined;   // current target value
  let from = 0;                     // value the current tween started from
  let startedAt = 0;                // when the current tween started (ms)
  let durationMs = 0;               // current tween duration (ms)
  let lastUpdateAt: number | undefined; // when the previous target arrived (ms)

  function valueAt(now: number): number | undefined {
    if (target === undefined) return undefined;
    if (durationMs <= 0) return target;
    const progress = Math.min(1, (now - startedAt) / durationMs);
    return Math.floor(from + (target - from) * progress);
  }

  function update(value: number | undefined, now: number): void {
    // Reset (thinking ended / new block): drop back to "no value".
    if (value === undefined) {
      target = undefined;
      durationMs = 0;
      lastUpdateAt = undefined;
      return;
    }
    // Same target — nothing to do.
    if (value === target) return;
    // First target: ease from 0 over the fixed first-run duration.
    if (target === undefined) {
      from = 0;
      startedAt = now;
      durationMs = TWEEN_FIRST_MS;
      target = value;
      lastUpdateAt = now;
      return;
    }
    // Decrease: jump immediately (the count never eases downward).
    if (value < target) {
      target = value;
      durationMs = 0;
      lastUpdateAt = now;
      return;
    }
    // Increase: restart the tween from wherever we are now, with a duration
    // matched to the observed cadence (clamped) so bigger gaps take longer.
    const sinceLast = lastUpdateAt === undefined ? TWEEN_MAX_MS : now - lastUpdateAt;
    from = valueAt(now) ?? value;
    startedAt = now;
    durationMs = Math.min(TWEEN_MAX_MS, Math.max(TWEEN_MIN_MS, sinceLast));
    target = value;
    lastUpdateAt = now;
  }

  return { update, valueAt };
}
