import React from 'react';
import { LoadedMessageDto, isContentBlockArray } from '../../types';
import { ToolUseBlockDto, ThinkingBlockDto, ContentBlockType } from '../../dto/message/ContentBlockDto';
import { StreamingMessage } from '../StreamingMessage';
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
      : blocks.every(block => {
          if (block.type === ContentBlockType.Text) return block.text.trim() === '';
          if (block.type === ContentBlockType.Thinking) return !(block as ThinkingBlockDto).thinking;
          return false;
        });
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
                    if (block.type === ContentBlockType.Thinking) {
                      return (
                          <ThinkingStreamingMessage
                              key={`${message.uuid}-thinking-${index}`}
                              thinking={(block as ThinkingBlockDto).thinking}
                              isStreaming={message.isStreaming ?? false}
                              className="text-zinc-200 text-[13px] leading-relaxed"
                              message={message}
                          />
                      );
                    }
                    if (block.type === ContentBlockType.Text) {
                      return (
                          <StreamingMessage
                              key={`${message.uuid}-text-${index}`}
                              content={block.text}
                              isStreaming={message.isStreaming ?? false}
                              className="text-zinc-200 text-[13px] leading-relaxed"
                              message={message}
                          />
                      );
                    }
                    if (block.type === ContentBlockType.ToolUse) {
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
            <ToolWrapper message={message} />
        )}

        {/*{message.context && <ContextPills context={message.context} />}*/}
      </>
  );
};
