import { describe, it, expect } from 'vitest';
import { LoadedMessageDto, isAuthErrorMessage } from '../index';
import { LoadedMessageType, toInstance } from '../../dto/common';

/**
 * Real-world auth-failure entry shape emitted by the Claude CLI stream-json:
 *   { type: 'assistant', message: { model: '<synthetic>', content: [{type:'text', text:'Failed to authenticate. API Error: 401 ...'}] },
 *     error: 'authentication_failed', isApiErrorMessage: true, apiErrorStatus: 401 }
 * Sample captured in ignore/auth-error-samples.md.
 */
describe('LoadedMessageDto.isAuthError', () => {
  function build(extra: Record<string, unknown>): LoadedMessageDto {
    return toInstance(LoadedMessageDto, {
      type: LoadedMessageType.Assistant,
      message: { role: 'assistant', content: [{ type: 'text', text: 'Failed to authenticate. API Error: 401 Invalid authentication credentials' }] },
      ...extra,
    });
  }

  it('is true for a 401 api error message', () => {
    const msg = build({ isApiErrorMessage: true, apiErrorStatus: 401, error: 'authentication_failed' });
    expect(isAuthErrorMessage(msg)).toBe(true);
  });

  it('is true when only the authentication_failed error code is present (no status)', () => {
    const msg = build({ isApiErrorMessage: true, error: 'authentication_failed' });
    expect(isAuthErrorMessage(msg)).toBe(true);
  });

  it('is true when only apiErrorStatus 401 is present (no error code)', () => {
    const msg = build({ isApiErrorMessage: true, apiErrorStatus: 401 });
    expect(isAuthErrorMessage(msg)).toBe(true);
  });

  it('is false for a non-auth api error (socket closed)', () => {
    const msg = toInstance(LoadedMessageDto, {
      type: LoadedMessageType.Assistant,
      message: { role: 'assistant', content: [{ type: 'text', text: 'API Error: The socket connection was closed unexpectedly' }] },
      isApiErrorMessage: true,
    });
    expect(isAuthErrorMessage(msg)).toBe(false);
  });

  it('is false for a usage-limit api error (no 401)', () => {
    const msg = toInstance(LoadedMessageDto, {
      type: LoadedMessageType.Assistant,
      message: { role: 'assistant', content: [{ type: 'text', text: "You've hit your limit · resets 7:40am" }] },
      isApiErrorMessage: true,
      apiErrorStatus: 429,
    });
    expect(isAuthErrorMessage(msg)).toBe(false);
  });

  it('is false for an ordinary assistant message', () => {
    const msg = toInstance(LoadedMessageDto, {
      type: LoadedMessageType.Assistant,
      message: { role: 'assistant', content: [{ type: 'text', text: 'Here is the answer.' }] },
    });
    expect(isAuthErrorMessage(msg)).toBe(false);
  });

  it('preserves the raw CLI fields through class-transformer (original-data preservation)', () => {
    const msg = build({ isApiErrorMessage: true, apiErrorStatus: 401, error: 'authentication_failed' });
    expect(msg.isApiErrorMessage).toBe(true);
    expect(msg.apiErrorStatus).toBe(401);
    expect(msg.error).toBe('authentication_failed');
  });
});

describe('isAuthErrorMessage (plain-object safe — live streaming path)', () => {
  it('detects auth errors on a plain object without class-transformer (live message)', () => {
    expect(isAuthErrorMessage({ isApiErrorMessage: true, apiErrorStatus: 401 })).toBe(true);
    expect(isAuthErrorMessage({ isApiErrorMessage: true, error: 'authentication_failed' })).toBe(true);
  });

  it('is false for non-auth or non-error plain objects', () => {
    expect(isAuthErrorMessage({ isApiErrorMessage: true, apiErrorStatus: 429 })).toBe(false);
    expect(isAuthErrorMessage({})).toBe(false);
  });
});
