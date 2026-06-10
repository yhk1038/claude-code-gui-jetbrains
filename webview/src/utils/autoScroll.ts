/** Default auto-scroll threshold in pixels. */
export const AUTO_SCROLL_THRESHOLD_DEFAULT = 80;
/** Smallest meaningful threshold. */
export const AUTO_SCROLL_THRESHOLD_MIN = 1;
/**
 * Upper bound for the threshold. The threshold is a distance from the bottom of
 * the message list; values larger than a typical viewport make the chat follow
 * the stream no matter where the user scrolls, which is the bug reported in
 * issue #87 (user had set it to 20000). Cap it to keep the setting usable.
 */
export const AUTO_SCROLL_THRESHOLD_MAX = 1000;

/** Clamp a user-supplied threshold into the supported range. */
export function clampAutoScrollThreshold(value: number): number {
  if (!Number.isFinite(value)) return AUTO_SCROLL_THRESHOLD_DEFAULT;
  const rounded = Math.round(value);
  return Math.min(AUTO_SCROLL_THRESHOLD_MAX, Math.max(AUTO_SCROLL_THRESHOLD_MIN, rounded));
}

/**
 * Decide whether the view is "near the bottom" and should keep auto-following
 * the stream.
 *
 * `referenceBottom` MUST be the top edge of the sticky input panel, NOT
 * window.innerHeight. The sentinel element sits directly above the input panel,
 * so anchoring to the panel top keeps `threshold` meaning a literal pixel
 * distance from the bottom of the message list. Comparing against
 * window.innerHeight instead adds the panel's height as a hidden offset, forcing
 * the user to scroll up `panelHeight + threshold` before auto-follow releases
 * (issue #87).
 */
export function isNearBottom(
  sentinelTop: number,
  referenceBottom: number,
  threshold: number,
): boolean {
  return sentinelTop <= referenceBottom + threshold;
}
