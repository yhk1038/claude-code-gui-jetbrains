import { describe, it, expect } from 'vitest';
import { findNewestUserUuid } from '../paging';
import { LoadedMessageType } from '../../../dto/common';
import type { LoadedMessageDto } from '../../../types';

function msg(type: LoadedMessageType, uuid?: string): LoadedMessageDto {
  return { type, uuid } as LoadedMessageDto;
}

describe('findNewestUserUuid', () => {
  it('returns null when there is no user message', () => {
    const messages = [msg(LoadedMessageType.Assistant, 'a-1'), msg(LoadedMessageType.System, 's-1')];
    expect(findNewestUserUuid(messages)).toBeNull();
  });

  it('returns the newest (last) user uuid when multiple user messages exist', () => {
    const messages = [
      msg(LoadedMessageType.User, 'u-1'),
      msg(LoadedMessageType.Assistant, 'a-1'),
      msg(LoadedMessageType.User, 'u-2'),
      msg(LoadedMessageType.Assistant, 'a-2'),
    ];
    expect(findNewestUserUuid(messages)).toBe('u-2');
  });

  it('returns the preceding user uuid even when the last message is an assistant placeholder', () => {
    // addUserMessage appends both a user message and an assistant placeholder for
    // non-streaming sends, so the newest array element is not the user message.
    const messages = [
      msg(LoadedMessageType.User, 'u-1'),
      msg(LoadedMessageType.User, 'u-2'),
      msg(LoadedMessageType.Assistant, 'a-placeholder'),
    ];
    expect(findNewestUserUuid(messages)).toBe('u-2');
  });

  it('is unaffected by an older-page prepend of a past user message', () => {
    const before = [
      msg(LoadedMessageType.User, 'u-1'),
      msg(LoadedMessageType.Assistant, 'a-1'),
    ];
    expect(findNewestUserUuid(before)).toBe('u-1');

    // Simulate prepending an older page in front of the existing messages.
    const afterPrepend = [
      msg(LoadedMessageType.User, 'u-older'),
      msg(LoadedMessageType.Assistant, 'a-older'),
      ...before,
    ];
    expect(findNewestUserUuid(afterPrepend)).toBe('u-1');
  });

  it('returns null for an empty array', () => {
    expect(findNewestUserUuid([])).toBeNull();
  });
});
