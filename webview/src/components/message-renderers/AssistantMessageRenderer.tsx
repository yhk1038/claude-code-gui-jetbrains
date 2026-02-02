import React from 'react';
import { Message, getTextContent } from '../../types';
import { StreamingMessage } from '../StreamingMessage';
import { useCopyToClipboard } from './hooks/useCopyToClipboard';
import { StreamingIndicator } from './components/StreamingIndicator';
import { ContextPills } from './components/ContextPills';
import { MessageActions } from './components/MessageActions';

interface AssistantMessageRendererProps {
  message: Message;
  onRetry?: (messageId: string) => void;
}

export const AssistantMessageRenderer: React.FC<AssistantMessageRendererProps> = ({
  message,
  onRetry,
}) => {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = () => {
    copy(getTextContent(message));
  };

  const handleRetry = onRetry ? () => onRetry(message.id) : undefined;

  return (
    <div className="group py-2 px-4 pl-4">
      <div className="flex items-start gap-2">
        {/* Bullet indicator */}
        <span className="text-zinc-500 mt-0.5 text-sm">●</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {message.isStreaming && <StreamingIndicator />}

          {message.content ? (
            <StreamingMessage
              content={getTextContent(message)}
              isStreaming={message.isStreaming ?? false}
              className="text-zinc-200 text-xs leading-relaxed"
            />
          ) : (
            <span className="text-zinc-600 italic">Thinking...</span>
          )}

          {message.context && <ContextPills context={message.context} />}
        </div>

        <MessageActions copied={copied} onCopy={handleCopy} onRetry={handleRetry} />
      </div>
    </div>
  );
};
