import { useEffect, useMemo, useRef, type RefObject } from 'react';
import {LoadedMessageDto, isContentBlockArray} from '../../types';
import { MessageBubble } from './MessageBubble';
import { ProjectSelectorPage } from '@/pages/ProjectSelectorPage';
import { ToolUseBlockDto, ToolResultBlockDto, ContentBlockType } from '../../dto/message/ContentBlockDto';
import { transformContentBlocks } from '../../mappers/contentBlockTransformer';
import type { SubAgentMessage } from '../../dto/message/ContentBlockDto';
import { useSessionContext } from '../../contexts/SessionContext';
import { useChatStreamContext } from '../../contexts/ChatStreamContext';
import { StreamErrorBanner } from './StreamErrorBanner';
import { LoadedMessageType, MessageRole } from '../../dto/common';
import './streaming.css';
import {StreamingIndicator} from "./StreamingIndicator/index.tsx";
import { EmptyState } from './EmptyState';
import { isJetBrains } from '@/config/environment';

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

interface Props {
  isStreaming: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  isUserNearBottom: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
}

export function ChatMessageArea(props: Props) {
  const { isStreaming, scrollContainerRef, isUserNearBottom, sentinelRef } = props;
  const { workingDirectory } = useSessionContext();
  const { messages, retry: onRetry } = useChatStreamContext();
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when user is near bottom (1s interval)
  useEffect(() => {
    if (!isUserNearBottom) return;

    const tick = () => {
      const el = scrollContainerRef.current;
      if (!el || !sentinelRef.current) return;

      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (dist <= 5) return; // already at bottom

      sentinelRef.current.scrollIntoView({ behavior: 'smooth' });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isUserNearBottom, scrollContainerRef, sentinelRef]);

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
    // JetBrains JCEF 환경에서는 workingDir이 항상 제공되므로 이 분기에 도달하지 않음 (방어적 처리)
    if (isJetBrains()) {
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-text-tertiary text-sm">Loading working directory...</p>
        </div>
      );
    }
    return <ProjectSelectorPage />;
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
    <div ref={containerRef} className="flex-1 text-xs" onClick={log}>
      {mergedMessages.map((message) => (
        <div key={message.uuid} onClick={() => console.log('message', message.uuid, message)}>
          <MessageBubble message={message} onRetry={onRetry} />
        </div>
      ))}
      {isStreaming && <StreamingIndicator />}
      <StreamErrorBanner />
      <div ref={sentinelRef as RefObject<HTMLDivElement>} />
    </div>
  );
}
