import { describe, it, expect } from 'vitest';
import { mergeToolResults } from '../mergeToolResults';
import { LoadedMessageType, MessageRole } from '../../../dto/common';
import { ContentBlockType } from '../../../dto/message/ContentBlockDto';
import type { LoadedMessageDto } from '../../../types';

function assistantWithTool(uuid: string, toolId: string, name: string): LoadedMessageDto {
  return {
    uuid,
    type: LoadedMessageType.Assistant,
    message: {
      role: MessageRole.Assistant,
      content: [
        { type: 'tool_use', id: toolId, name, input: { command: 'ls' } },
      ],
    },
    timestamp: '2026-01-01T00:00:00.000Z',
  } as unknown as LoadedMessageDto;
}

function toolResultUser(
  uuid: string,
  toolId: string,
  content: string | Array<{ type: string; text: string }>,
): LoadedMessageDto {
  return {
    uuid,
    type: LoadedMessageType.User,
    message: {
      role: MessageRole.User,
      content: [
        { type: 'tool_result', tool_use_id: toolId, content },
      ],
    },
    timestamp: '2026-01-01T00:00:01.000Z',
  } as unknown as LoadedMessageDto;
}

function getToolUseBlock(msg: LoadedMessageDto) {
  const content = msg.message?.content as unknown as Array<Record<string, unknown>>;
  return content.find(b => b.type === ContentBlockType.ToolUse) as Record<string, unknown> | undefined;
}

describe('mergeToolResults', () => {
  it('merges a tool_result into the preceding assistant tool_use block (string content)', () => {
    const messages = [
      assistantWithTool('a1', 'tool1', 'Bash'),
      toolResultUser('u1', 'tool1', 'command output here'),
    ];

    const merged = mergeToolResults(messages);

    // the tool_result-only user message must be hidden from the rendered list
    expect(merged.find(m => m.uuid === 'u1')).toBeUndefined();

    // the assistant message remains, and its tool_use block now carries the result
    const assistant = merged.find(m => m.uuid === 'a1');
    expect(assistant).toBeDefined();
    const toolUseBlock = getToolUseBlock(assistant!);
    expect(toolUseBlock).toBeDefined();
    expect(toolUseBlock!.tool_result).toBeDefined();
    expect((toolUseBlock!.tool_result as LoadedMessageDto).uuid).toBe('u1');
  });

  it('merges a tool_result whose content is a content-block array', () => {
    const messages = [
      assistantWithTool('a1', 'tool1', 'Task'),
      toolResultUser('u1', 'tool1', [{ type: 'text', text: 'sub-agent done' }]),
    ];

    const merged = mergeToolResults(messages);

    const assistant = merged.find(m => m.uuid === 'a1')!;
    const toolUseBlock = getToolUseBlock(assistant);
    expect(toolUseBlock!.tool_result).toBeDefined();
  });

  it('does not mutate the original messages array or its blocks', () => {
    const messages = [
      assistantWithTool('a1', 'tool1', 'Bash'),
      toolResultUser('u1', 'tool1', 'output'),
    ];

    mergeToolResults(messages);

    // original assistant block must stay untouched (no in-place mutation)
    const originalBlock = getToolUseBlock(messages[0]);
    expect(originalBlock!.tool_result).toBeUndefined();
  });

  it('keeps non-tool messages as their original references', () => {
    const userMsg = {
      uuid: 'u0',
      type: LoadedMessageType.User,
      message: { role: MessageRole.User, content: 'hi' },
      timestamp: '2026-01-01T00:00:00.000Z',
    } as unknown as LoadedMessageDto;

    const merged = mergeToolResults([userMsg]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(userMsg); // same reference → MessageBubble memo bailout holds
  });
});
