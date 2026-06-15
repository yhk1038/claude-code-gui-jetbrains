import { describe, it, expect } from 'vitest';
import { toolResultText } from '../index';
import { LoadedMessageType, MessageRole } from '@/dto/common';
import type { LoadedMessageDto } from '@/types';

function toolResultMsg(content: unknown): LoadedMessageDto {
  return {
    type: LoadedMessageType.User,
    message: {
      role: MessageRole.User,
      content: [{ type: 'tool_result', tool_use_id: 't1', content }],
    },
  } as unknown as LoadedMessageDto;
}

describe('toolResultText', () => {
  it('returns string content as-is (e.g. Bash output)', () => {
    expect(toolResultText(toolResultMsg('command output'))).toBe('command output');
  });

  it('joins text blocks when content is a content-block array (e.g. Task output)', () => {
    const msg = toolResultMsg([
      { type: 'text', text: 'line1\n' },
      { type: 'text', text: 'line2' },
    ]);
    expect(toolResultText(msg)).toBe('line1\nline2');
  });

  it('returns empty string for undefined tool_result', () => {
    expect(toolResultText(undefined)).toBe('');
  });

  it('returns empty string when the first block is not a tool_result', () => {
    const msg = {
      type: LoadedMessageType.User,
      message: { role: MessageRole.User, content: [{ type: 'text', text: 'x' }] },
    } as unknown as LoadedMessageDto;
    expect(toolResultText(msg)).toBe('');
  });
});
