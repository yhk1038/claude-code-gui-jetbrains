import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {LoadedMessageDto, isContentBlockArray} from '../types';
import { MessageBubble } from './MessageBubble';
import { ProjectSelector } from './ProjectSelector';
import { ToolUseBlockDto, ToolResultBlockDto, ContentBlockType } from '../dto/message/ContentBlockDto';
import { transformContentBlocks } from '../mappers/contentBlockTransformer';
import type { SubAgentMessage } from '../dto/message/ContentBlockDto';
import { useSessionContext } from '../contexts/SessionContext';
import { useChatStreamContext } from '../contexts/ChatStreamContext';
import { StreamErrorBanner } from './StreamErrorBanner';
import { LoadedMessageType, MessageRole } from '../dto/common';
import './streaming.css';
import {StreamingIndicator} from "./StreamingIndicator/index.tsx";
import { EmptyState } from './EmptyState';

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
        role: msgData.role as MessageRole,
        timestamp: entry.timestamp ?? '',
      };
    })
    .sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
}

const SCROLL_THRESHOLD = 80;

interface Props {
  isStreaming: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

export function ChatMessageArea(props: Props) {
  const { isStreaming, scrollContainerRef } = props;
  const { workingDirectory, setWorkingDirectory } = useSessionContext();
  const { messages, retry: onRetry } = useChatStreamContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isUserNearBottom, setIsUserNearBottom] = useState(true);

  // 스크롤 컨테이너의 스크롤 이벤트를 감지하여 사용자가 하단 근처인지 판별
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsUserNearBottom(distanceFromBottom <= SCROLL_THRESHOLD);
  }, [scrollContainerRef]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef, handleScroll]);

  // 사용자가 하단 근처에 있을 때만 자동 스크롤
  useEffect(() => {
    if (isUserNearBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isUserNearBottom, messages.length, messages[messages.length - 1]?.message?.content]);

  // Merge tool_result user messages into preceding assistant's tool_use blocks
  const mergedMessages = useMemo(() => {
    // Phase 0: Collect progress entries grouped by parentToolUseID
    const progressMap = new Map<string, LoadedMessageDto[]>();
    for (const msg of messages) {
      if (msg.type === LoadedMessageType.Progress && msg.parentToolUseID) {
        const list = progressMap.get(msg.parentToolUseID) || [];
        list.push(msg);
        progressMap.set(msg.parentToolUseID, list);
      }
    }

    // Build tool_use_id → ToolUseBlockDto lookup from all assistant messages
    const toolUseMap = new Map<string, ToolUseBlockDto>();
    for (const msg of messages) {
      if (msg.type !== LoadedMessageType.Assistant) continue;
      const content = msg.message?.content;
      if (!isContentBlockArray(content)) continue;
      for (const block of content) {
        if (block.type === ContentBlockType.ToolUse) {
          toolUseMap.set((block as ToolUseBlockDto).id, block as ToolUseBlockDto);
        }
      }
    }

    // Reset runtime-only fields to prevent duplication on re-render (e.g. React StrictMode)
    for (const toolUseBlock of toolUseMap.values()) {
      toolUseBlock.tool_result = undefined;
      toolUseBlock.childMessages = undefined;
      toolUseBlock.subAgentMessages = undefined;
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
      if (msg.type === LoadedMessageType.Progress) continue; // Skip progress entries (rendered inside TaskRenderer)
      if (msg.type === LoadedMessageType.User) {
        // Phase 2a: Attach child messages linked via sourceToolUseID (e.g. skill-expanded prompts)
        if (msg.sourceToolUseID) {
          const toolUseBlock = toolUseMap.get(msg.sourceToolUseID);
          if (toolUseBlock) {
            if (!toolUseBlock.childMessages) toolUseBlock.childMessages = [];
            toolUseBlock.childMessages.push(msg);
            continue; // Don't add to result (rendered inside tool renderer)
          }
        }

        // Phase 2b: Attach tool_result messages
        const content = msg.message?.content;
        if (isContentBlockArray(content)) {
          const isToolResultOnly = content.every(block => block.type === ContentBlockType.ToolResult);
          if (isToolResultOnly) {
            // Attach this message to each matching tool_use block
            for (const block of content) {
              if (block.type === ContentBlockType.ToolResult) {
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
    // JetBrains에서는 URL에 ?workingDir= 파라미터가 포함되므로 이 분기에 도달하지 않음
    // kotlinBridge가 존재하면 로딩 상태 표시 (방어적 처리)
    if (window.kotlinBridge) {
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-zinc-500 text-sm">Loading working directory...</p>
        </div>
      );
    }
    return <ProjectSelector onSelectProject={setWorkingDirectory} />;
  }

  const log = () => {
    // console.log('messages', messages);
    // console.log('mergedMessages', mergedMessages)
  }

  // Empty state: no messages yet
  if (isEmpty) {
    return <EmptyState />;
  }

  // Render messages with widgets
  return (
    <div ref={containerRef} className="max-w-4xl mx-auto text-xs" onClick={log}>
      {mergedMessages.map((message) => (
        <div key={message.uuid} onClick={() => console.log('message', message.uuid, message)}>
          <MessageBubble message={message} onRetry={onRetry} />
        </div>
      ))}
      {isStreaming && <StreamingIndicator />}
      <StreamErrorBanner />
      <div ref={messagesEndRef} />
    </div>
  );
}
