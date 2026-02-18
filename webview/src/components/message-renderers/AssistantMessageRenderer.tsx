import React from 'react';
import { LoadedMessageDto, isContentBlockArray } from '../../types';
import { ToolUseBlockDto } from '../../dto/message/ContentBlockDto';
import { StreamingMessage } from '../StreamingMessage';
import { StreamingIndicator } from './components/StreamingIndicator';
import { ContextPills } from './components/ContextPills';
import { ToolRenderer } from './ToolRenderer';
import {ThinkingStreamingMessage} from "@/components/ThinkingStreamingMessage.tsx";

interface AssistantMessageRendererProps {
  message: LoadedMessageDto;
  onRetry?: (messageId: string) => void;
}

export const AssistantMessageRenderer: React.FC<AssistantMessageRendererProps> = ({
  message,
}) => {
  const content = message.message?.content;
  const blocks = isContentBlockArray(content) ? content : [];
  const hasContent = blocks.length > 0 || typeof content === 'string';

  // Skip rendering if message has no meaningful content (e.g. interrupted empty responses)
  if (!message.isStreaming) {
    const isEmpty = typeof content === 'string'
      ? content.trim() === ''
      : blocks.every(block =>
          block.type === 'text' ? block.text.trim() === '' : false
        );
    if (isEmpty) return null;
  }

  return (
    <div className="group py-2 px-4 pl-4">
      <div className="flex items-start gap-2">
        {/* Bullet indicator */}
        <span className="text-zinc-500 mt-[3px] text-[9px]">●</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {message.isStreaming && <StreamingIndicator />}

          {hasContent ? (
            <>
              {typeof content === 'string' ? (
                <StreamingMessage
                  content={content}
                  isStreaming={message.isStreaming ?? false}
                  className="text-zinc-200 text-[13px] leading-relaxed"
                />
              ) : (
                blocks.map((block, index) => {
                  if (block.type === 'text') {
                    if (block.text.startsWith('{"type":"thinking"')) {
                      return (
                          <ThinkingStreamingMessage
                              key={index}
                              content={block.text}
                              isStreaming={message.isStreaming ?? false}
                              className="text-zinc-200 text-[13px] leading-relaxed"
                          />
                      );
                    }

                    return (
                      <StreamingMessage
                        key={index}
                        content={block.text}
                        isStreaming={message.isStreaming ?? false}
                        className="text-zinc-200 text-[13px] leading-relaxed"
                      />
                    );
                  }
                  if (block.type === 'tool_use') {
                    return (
                      <ToolRenderer
                        key={(block as ToolUseBlockDto).id}
                        toolUse={block as ToolUseBlockDto}
                      />
                    );
                  }
                  return null;
                })
              )}
            </>
          ) : (
            <span className="text-zinc-600 italic">Thinking...</span>
          )}

          {message.context && <ContextPills context={message.context} />}
        </div>
      </div>
    </div>
  );
};
