import React from 'react';
import { Message, getTextContent } from '../../types';
import { useCopyToClipboard } from './hooks/useCopyToClipboard';
import { ContextPills } from './components/ContextPills';
import { ImageAttachments } from './components/ImageAttachments';
import { MessageActions } from './components/MessageActions';
import { parseUserContent } from './utils/parseUserContent';

interface UserMessageRendererProps {
  message: Message;
}

export const UserMessageRenderer: React.FC<UserMessageRendererProps> = ({ message }) => {
  const { copied, copy } = useCopyToClipboard();
  const parsedContent = parseUserContent(getTextContent(message));
  console.log('message', message);

  const handleCopy = () => {
    copy(parsedContent.text);
  };

  return (
    <div className="group py-2 px-4 pl-8">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="bg-zinc-800/80 rounded-lg px-4 py-3">
            <div className="text-zinc-200 text-xs leading-relaxed whitespace-pre-wrap break-words">
              {parsedContent.text}
            </div>
          </div>

          {message.context && <ContextPills context={message.context} />}
          {message.images && message.images.length > 0 && (
            <ImageAttachments images={message.images} />
          )}
        </div>

        <MessageActions copied={copied} onCopy={handleCopy} />
      </div>
    </div>
  );
};
