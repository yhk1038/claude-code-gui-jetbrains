import { LoadedMessageDto, isContentBlockArray } from '../../types';
import { ToolUseBlockDto, ToolResultBlockDto, ContentBlockType } from '../../dto/message/ContentBlockDto';
import { transformContentBlocks } from '../../mappers/contentBlockTransformer';
import type { SubAgentMessage } from '../../dto/message/ContentBlockDto';
import { LoadedMessageType, MessageRole } from '../../dto/common';

/**
 * Convert progress entries into SubAgentMessage array.
 * Filters to only `agent_progress` type (excludes `hook_progress` and others).
 * Both assistant (tool_use) and user (tool_result) roles are preserved;
 * merging of tool_result into tool_use happens in TaskRenderer.
 */
export function buildSubAgentMessages(progressEntries: LoadedMessageDto[]): SubAgentMessage[] {
  return progressEntries
    .filter(entry => entry.data?.type === 'agent_progress' && entry.data?.message)
    .map(entry => {
      const msgData = entry.data!.message.message;
      const content = transformContentBlocks(msgData.content);
      return {
        content,
        role: msgData.role as MessageRole,
        timestamp: entry.timestamp ?? '',
      };
    })
    .sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
}

/**
 * Merge tool_result user messages into the preceding assistant's tool_use blocks,
 * attach sub-agent progress (Task) and child messages (Skill), and hide the
 * now-merged user messages from the rendered list.
 *
 * Returns a new array; the input messages and their nested blocks are never mutated.
 */
export function mergeToolResults(messages: LoadedMessageDto[]): LoadedMessageDto[] {
  // Phase 0: Collect progress entries grouped by parentToolUseID
  const progressMap = new Map<string, LoadedMessageDto[]>();
  for (const msg of messages) {
    if (msg.type === LoadedMessageType.Progress && msg.parentToolUseID) {
      const list = progressMap.get(msg.parentToolUseID) || [];
      list.push(msg);
      progressMap.set(msg.parentToolUseID, list);
    }
  }

  // Build tool_use_id → cloned ToolUseBlockDto lookup from all assistant messages.
  // Cloning prevents mutation of the original block objects (which live on the
  // shared messages array). In-place mutation would break React.memo bailouts on
  // MessageBubble — referential equality holds, but the cloned inner block would
  // be wrong — and could also duplicate runtime fields on re-render
  // (e.g. React StrictMode).
  const toolUseMap = new Map<string, ToolUseBlockDto>();
  for (const msg of messages) {
    if (msg.type !== LoadedMessageType.Assistant) continue;
    const content = msg.message?.content;
    if (!isContentBlockArray(content)) continue;
    for (const block of content) {
      if (block.type === ContentBlockType.ToolUse) {
        const orig = block as ToolUseBlockDto;
        toolUseMap.set(orig.id, {
          ...orig,
          tool_result: undefined,
          childMessages: undefined,
          subAgentMessages: undefined,
        });
      }
    }
  }

  // Phase 1.5: Attach progress entries to Task tool_use blocks
  for (const [parentId, progressEntries] of progressMap) {
    const toolUseBlock = toolUseMap.get(parentId);
    if (toolUseBlock) {
      toolUseBlock.subAgentMessages = buildSubAgentMessages(progressEntries);
    }
  }

  // Phase 2: Attach tool_result / child messages to the tool_use clones and
  // record which user messages are now merged (and must be hidden). Tracked by
  // object reference since uuid is optional.
  const mergedUserMsgs = new Set<LoadedMessageDto>();
  for (const msg of messages) {
    if (msg.type !== LoadedMessageType.User) continue;

    // Phase 2a: Attach child messages linked via sourceToolUseID (e.g. skill-expanded prompts)
    if (msg.sourceToolUseID) {
      const toolUseBlock = toolUseMap.get(msg.sourceToolUseID);
      if (toolUseBlock) {
        if (!toolUseBlock.childMessages) toolUseBlock.childMessages = [];
        toolUseBlock.childMessages.push(msg);
        mergedUserMsgs.add(msg);
        continue; // Rendered inside the tool renderer
      }
    }

    // Phase 2b: Attach tool_result messages
    const content = msg.message?.content;
    if (isContentBlockArray(content)) {
      const isToolResultOnly = content.every(block => block.type === ContentBlockType.ToolResult);
      if (isToolResultOnly) {
        for (const block of content) {
          if (block.type === ContentBlockType.ToolResult) {
            const toolUseBlock = toolUseMap.get((block as ToolResultBlockDto).tool_use_id);
            if (toolUseBlock) {
              toolUseBlock.tool_result = msg;
            }
          }
        }
        mergedUserMsgs.add(msg);
      }
    }
  }

  // Phase 3: Build the rendered list. Progress entries and merged tool_result
  // user messages are hidden. Assistant messages that contain tool_use blocks
  // are rebuilt as NEW objects whose blocks point at the merged clones — this is
  // what surfaces the tool_result (OUT), sub-agent progress and child messages
  // in the UI. Messages without tool_use keep their original reference so
  // MessageBubble's React.memo bailout still holds.
  const result: LoadedMessageDto[] = [];
  for (const msg of messages) {
    if (msg.type === LoadedMessageType.Progress) continue;
    if (msg.type === LoadedMessageType.User && mergedUserMsgs.has(msg)) continue;

    if (msg.type === LoadedMessageType.Assistant) {
      const message = msg.message;
      const content = message?.content;
      if (message && isContentBlockArray(content) && content.some(b => b.type === ContentBlockType.ToolUse)) {
        const newContent = content.map(block =>
          block.type === ContentBlockType.ToolUse
            ? (toolUseMap.get((block as ToolUseBlockDto).id) ?? block)
            : block,
        );
        result.push({ ...msg, message: { ...message, content: newContent } });
        continue;
      }
    }
    result.push(msg);
  }
  return result;
}
