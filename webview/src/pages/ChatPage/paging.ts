/**
 * Decide whether an `oldestLoadedUuid` transition represents an actual
 * older-page prepend (the event the scroll-anchoring layout effect must react
 * to) rather than a streaming update or the initial load.
 *
 * The oldest loaded message only changes when an older page is prepended:
 *  - Streaming deltas grow the *newest* messages, so `oldestLoadedUuid` stays
 *    put -> not a prepend (returning true here is what made the viewport jump).
 *  - The initial load moves the oldest from `null` to a real value; that is not
 *    a prepend either, so a `null` previous value is excluded.
 *
 * A prepend is therefore: the previous oldest was a real (non-null) uuid AND
 * the current oldest differs from it.
 */
export function isOlderPagePrepend(
  prevOldestUuid: string | null,
  currentOldestUuid: string | null,
): boolean {
  return prevOldestUuid !== null && currentOldestUuid !== prevOldestUuid;
}
