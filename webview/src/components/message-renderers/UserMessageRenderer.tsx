import React from 'react';
import { LoadedMessageDto, getTextContent } from '../../types';
import { useCopyToClipboard } from './hooks/useCopyToClipboard';
import { ContextPills } from './components/ContextPills';
import { ImageAttachments } from './components/ImageAttachments';
import { MessageActions } from './components/MessageActions';
import { parseUserContent } from './utils/parseUserContent';

interface UserMessageRendererProps {
  message: LoadedMessageDto;
}

export const UserMessageRenderer: React.FC<UserMessageRendererProps> = ({ message }) => {
  const { copied, copy } = useCopyToClipboard();
  const parsedContent = parseUserContent(getTextContent(message));

  const handleCopy = () => {
    copy(parsedContent.text);
  };

  const allContexts = [
    ...(parsedContent.contexts || []),
    ...(message.context || []),
  ];

  return (
    <div className="group py-2 px-4 pl-8">
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <div className="bg-zinc-800/80 border border-white/25 rounded-lg px-[8px] py-[3.5px]">
            <div className="text-white/80 text-[13px] leading-relaxed whitespace-pre-wrap break-words">
              {parsedContent.text}
            </div>
          </div>

          {allContexts.length > 0 && <ContextPills context={allContexts} />}
          {message.images && message.images.length > 0 && (
            <ImageAttachments images={message.images} />
          )}
        </div>

        <MessageActions copied={copied} onCopy={handleCopy} />
      </div>
    </div>
  );
};
