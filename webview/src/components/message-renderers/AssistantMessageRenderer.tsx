import React from 'react';
import { LoadedMessageDto, isContentBlockArray } from '../../types';
import { ToolUseBlockDto } from '../../dto/message/ContentBlockDto';
import { StreamingMessage } from '../StreamingMessage';
import { StreamingIndicator } from './components/StreamingIndicator';
import { ContextPills } from './components/ContextPills';
import { ToolRenderer } from './ToolRenderer';
import {ThinkingStreamingMessage} from "@/components/ThinkingStreamingMessage.tsx";
import {ToolWrapper} from "@/components/message-renderers/ToolRenderers/common";

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
      <>
        {/*{message.isStreaming && <StreamingIndicator />}*/}

        {hasContent ? (
            <>
              {typeof content === 'string' ? (
                  <StreamingMessage
                      content={content}
                      isStreaming={message.isStreaming ?? false}
                      className="text-zinc-200 text-[13px] leading-relaxed"
                      message={message}
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
                                message={message}
                            />
                        );
                      }

                      return (
                          <StreamingMessage
                              key={index}
                              content={block.text}
                              isStreaming={message.isStreaming ?? false}
                              className="text-zinc-200 text-[13px] leading-relaxed"
                              message={message}
                          />
                      );
                    }
                    if (block.type === 'tool_use') {
                      return (
                          <ToolRenderer
                              key={(block as ToolUseBlockDto).id}
                              toolUse={block as ToolUseBlockDto}
                              message={message}
                          />
                      );
                    }
                    return null;
                  })
              )}
            </>
        ) : (
            <ToolWrapper message={message}>
              <span className="text-zinc-600 italic">Thinking...</span>
            </ToolWrapper>
        )}

        {/*{message.context && <ContextPills context={message.context} />}*/}
      </>
  );
};
