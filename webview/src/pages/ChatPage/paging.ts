import type { LoadedMessageDto } from '../../types';
import { LoadedMessageType } from '../../dto/common';

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

/**
 * Find the uuid of the newest (last, by array position) `User` type message.
 *
 * Used to detect a fresh send so the caller can re-arm auto-follow: a plain
 * "last element is user" check is not enough, because a non-streaming send
 * appends both the user message *and* an assistant placeholder
 * (see `useChatStream.ts` `addUserMessage`), leaving the placeholder as the
 * last array element. Searching from the back for the first `User` type
 * message correctly skips that placeholder.
 *
 * An older-page prepend inserts past user messages at the *front* of the
 * array, so it never changes which uuid is newest — no false positive there.
 */
export function findNewestUserUuid(messages: LoadedMessageDto[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === LoadedMessageType.User) {
      return messages[i].uuid ?? null;
    }
  }
  return null;
}
