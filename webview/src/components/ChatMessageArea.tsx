import { useEffect, useMemo, useRef } from 'react';
import {LoadedMessageDto, isContentBlockArray} from '../types';
import { MessageBubble } from './MessageBubble';
import { ProjectSelector } from './ProjectSelector';
import { ToolUseBlockDto, ToolResultBlockDto } from '../dto/message/ContentBlockDto';
import { transformContentBlocks } from '../mappers/contentBlockTransformer';
import type { SubAgentMessage } from '../dto/message/ContentBlockDto';

interface ChatMessageAreaProps {
  messages: LoadedMessageDto[];
  streamingMessageId: string | null;
  workingDirectory: string | null;
  onSelectProject: (path: string) => void;
  onRetry: (messageId: string) => void;
  approveToolUse: (toolId: string) => void;
  denyToolUse: (toolId: string) => void;
}

/**
 * Convert progress entries into SubAgentMessage array.
 * Filters to only `agent_progress` type (excludes `hook_progress` and others).
 * Both assistant (tool_use) and user (tool_result) roles are preserved;
 * merging of tool_result into tool_use happens in TaskRenderer.
 */
function buildSubAgentMessages(progressEntries: LoadedMessageDto[]): SubAgentMessage[] {
  return progressEntries
    .filter(entry => entry.data?.type === 'agent_progress' && entry.data?.message)
    .map(entry => {
      const msgData = entry.data!.message.message;
      const content = transformContentBlocks(msgData.content);
      return {
        content,
        role: msgData.role as 'assistant' | 'user',
        timestamp: entry.timestamp ?? '',
      };
    })
    .sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
}

export function ChatMessageArea({
  messages,
  streamingMessageId: _streamingMessageId,
  workingDirectory,
  onSelectProject,
  onRetry,
  // approveToolUse,
  // denyToolUse,
}: ChatMessageAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or streaming updates
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, messages[messages.length - 1]?.message?.content]);

  // Merge tool_result user messages into preceding assistant's tool_use blocks
  const mergedMessages = useMemo(() => {
    // Phase 0: Collect progress entries grouped by parentToolUseID
    const progressMap = new Map<string, LoadedMessageDto[]>();
    for (const msg of messages) {
      if (msg.type === 'progress' && msg.parentToolUseID) {
        const list = progressMap.get(msg.parentToolUseID) || [];
        list.push(msg);
        progressMap.set(msg.parentToolUseID, list);
      }
    }

    // Build tool_use_id → ToolUseBlockDto lookup from all assistant messages
    const toolUseMap = new Map<string, ToolUseBlockDto>();
    for (const msg of messages) {
      if (msg.type !== 'assistant') continue;
      const content = msg.message?.content;
      if (!isContentBlockArray(content)) continue;
      for (const block of content) {
        if (block.type === 'tool_use') {
          toolUseMap.set((block as ToolUseBlockDto).id, block as ToolUseBlockDto);
        }
      }
    }

    // Phase 1.5: Attach progress entries to Task tool_use blocks
    for (const [parentId, progressEntries] of progressMap) {
      const toolUseBlock = toolUseMap.get(parentId);
      if (toolUseBlock && toolUseBlock.name === 'Task') {
        toolUseBlock.subAgentMessages = buildSubAgentMessages(progressEntries);
      }
    }

    // Attach tool_result messages to matching tool_use blocks and filter them out
    const result: LoadedMessageDto[] = [];
    for (const msg of messages) {
      if (msg.type === 'progress') continue; // Skip progress entries (rendered inside TaskRenderer)
      if (msg.type === 'user') {
        const content = msg.message?.content;
        if (isContentBlockArray(content)) {
          const isToolResultOnly = content.every(block => block.type === 'tool_result');
          if (isToolResultOnly) {
            // Attach this message to each matching tool_use block
            for (const block of content) {
              if (block.type === 'tool_result') {
                const toolUseBlock = toolUseMap.get((block as ToolResultBlockDto).tool_use_id);
                if (toolUseBlock) {
                  toolUseBlock.tool_result = msg;
                }
              }
            }
            continue; // Don't add to result (hidden)
          }
        }
      }
      result.push(msg);
    }
    return result;
  }, [messages]);

  const isEmpty = mergedMessages.length === 0;

  // No working directory: show ProjectSelector or loading
  if (!workingDirectory) {
    // JetBrains에서는 kotlinBridge가 workingDirectory를 주입하므로 ProjectSelector 불필요
    if (window.kotlinBridge) {
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-zinc-500 text-sm">워킹 디렉토리를 불러오는 중...</p>
        </div>
      );
    }
    return <ProjectSelector onSelectProject={onSelectProject} />;
  }

  // Empty state: no messages yet
  if (isEmpty) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500 text-sm">메시지를 입력하세요</p>
      </div>
    );
  }

  // Render messages with widgets
  return (
    <div ref={containerRef} className="max-w-4xl mx-auto text-xs">
      {mergedMessages.map((message) => (
        <div key={message.uuid} onClick={() => console.log('message', message.uuid, message)}>
          <MessageBubble message={message} onRetry={onRetry} />
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
