/** Default auto-scroll resume distance in pixels. */
export const AUTO_SCROLL_THRESHOLD_DEFAULT = 80;
/** Smallest meaningful resume distance. */
export const AUTO_SCROLL_THRESHOLD_MIN = 1;
/**
 * Upper bound for the resume distance. This is how close to the bottom the user
 * must scroll back before auto-follow re-engages; values larger than a typical
 * viewport make the chat re-grab the stream from almost anywhere, which is the
 * spirit of the bug reported in issue #87 (user had set it to 20000). Cap it to
 * keep the setting usable.
 */
export const AUTO_SCROLL_THRESHOLD_MAX = 1000;

/**
 * Minimum upward scroll (in px) that counts as a deliberate user scroll and
 * releases auto-follow. Absorbs sub-pixel rendering jitter so the view does not
 * stop following on its own.
 */
export const AUTO_SCROLL_RELEASE_EPS = 2;

/**
 * Distance from the bottom (in px) below which the view is considered already
 * pinned, so no further programmatic scroll is issued.
 */
export const AUTO_SCROLL_BOTTOM_EPS = 5;

/** Clamp a user-supplied resume distance into the supported range. */
export function clampAutoScrollThreshold(value: number): number {
  if (!Number.isFinite(value)) return AUTO_SCROLL_THRESHOLD_DEFAULT;
  const rounded = Math.round(value);
  return Math.min(AUTO_SCROLL_THRESHOLD_MAX, Math.max(AUTO_SCROLL_THRESHOLD_MIN, rounded));
}

/**
 * Decide the next auto-follow state from a single scroll measurement.
 *
 * Auto-follow tracks user *intent*, not viewport position. The key insight
 * (issue #100): a large block inserted at once grows `scrollHeight` while
 * `scrollTop` stays put, pushing the bottom far away — but the user did not
 * move, so following must continue. Only a negative `scrollDelta` (the user
 * scrolling up) releases it.
 *
 * Rules, in priority order:
 *  - release: `scrollDelta < -releaseEps` (user scrolled up) -> false.
 *    Wins over resume, so scrolling up always stops following even near bottom.
 *  - resume: the user actively scrolls *down* (`scrollDelta > releaseEps`) to
 *    within `resumeThreshold` of the bottom -> true. Merely *being* near the
 *    bottom must NOT re-grab the view: otherwise a small upward nudge inside the
 *    resume distance releases and then snaps straight back on the next idle tick.
 *  - otherwise: keep `prev` (content growth with delta ~= 0, or idle).
 */
export function nextAutoFollow(
  prev: boolean,
  scrollDelta: number,
  distanceFromBottom: number,
  resumeThreshold: number,
  releaseEps: number = AUTO_SCROLL_RELEASE_EPS,
): boolean {
  if (scrollDelta < -releaseEps) return false;
  if (scrollDelta > releaseEps && distanceFromBottom <= resumeThreshold) return true;
  return prev;
}

/**
 * Decide whether the "Scroll to bottom" button should be visible.
 *
 * The button is only useful when the user is genuinely stranded above the
 * stream, so it hides whenever ANY of these hold:
 *  - auto-follow is active (the view already tracks the bottom)
 *  - there are no messages (an uninitialized session has nothing to scroll)
 *  - the view is already within `threshold` px of the bottom
 *
 * This must NOT be conflated with auto-follow alone: auto-follow tracks user
 * *intent*, so a tiny upward nudge while pinned near the bottom releases it —
 * but the button should stay hidden there because the user can already see the
 * bottom. Visibility is therefore a separate, position-aware decision.
 */
export function shouldShowScrollToBottom(
  autoFollow: boolean,
  hasMessages: boolean,
  distanceFromBottom: number,
  threshold: number,
): boolean {
  if (autoFollow) return false;
  if (!hasMessages) return false;
  if (distanceFromBottom <= threshold) return false;
  return true;
}
