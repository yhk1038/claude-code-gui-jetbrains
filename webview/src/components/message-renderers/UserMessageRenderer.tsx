import React, { useMemo } from 'react';
import { LoadedMessageDto, getTextContent, isContentBlockArray } from '../../types';
import type { ImageBlockDto } from '../../dto/message/ContentBlockDto';
import { ContentBlockType } from '../../dto/message/ContentBlockDto';
import { useCopyToClipboard } from './hooks/useCopyToClipboard';
import { ContextPills } from './components/ContextPills';
import { ImageAttachments } from './components/ImageAttachments';
import { MessageActions } from './components/MessageActions';
import { parseUserContent } from './utils/parseUserContent';
import { InterruptedMessageRenderer } from './InterruptedMessageRenderer';
import { MessageBox } from './components/MessageBox';

interface UserMessageRendererProps {
  message: LoadedMessageDto;
}

const INTERRUPTED_TEXT = '[Request interrupted by user]';
const INTERRUPTED_FOR_TOOL_USE_TEXT = '[Request interrupted by user for tool use]';

export const UserMessageRenderer: React.FC<UserMessageRendererProps> = ({ message }) => {
  const { copied, copy } = useCopyToClipboard();
  const parsedContent = parseUserContent(getTextContent(message));

  const imageBlocks = useMemo(() => {
    const content = message.message?.content;
    if (!isContentBlockArray(content)) return [];
    return content.filter((b): b is ImageBlockDto => b.type === ContentBlockType.Image);
  }, [message.message?.content]);

  const handleCopy = () => {
    copy(parsedContent.text);
  };

  const allContexts = [
    ...(parsedContent.contexts || []),
    ...(message.context || []),
  ];

  // Route interrupted messages to dedicated renderer
  if (parsedContent.text.trim() === INTERRUPTED_TEXT) {
    return <InterruptedMessageRenderer message={message} />;
  }

  // Route tool use interrupted messages with custom label
  if (parsedContent.text.trim() === INTERRUPTED_FOR_TOOL_USE_TEXT) {
    return <InterruptedMessageRenderer message={message} label="Tool interrupted" />;
  }

  // Skip rendering for local-command-caveat without text or command name
  if (parsedContent.hasLocalCommandCaveat && !parsedContent.text && !parsedContent.commandName) {
    return null;
  }

  // Render command-name style messages
  if (parsedContent.commandName) {
    return (
      <div className="group py-2 px-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <MessageBox collapsible={false}>
              <div className="text-white/80 text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                <span className="text-white/50">{'/'}</span>{parsedContent.commandName}
                {parsedContent.text && (
                  <span className="text-white/50">{' '}{parsedContent.text}</span>
                )}
              </div>
            </MessageBox>
            {allContexts.length > 0 && <ContextPills context={allContexts} />}
          </div>
          <MessageActions copied={copied} onCopy={handleCopy} />
        </div>
      </div>
    );
  }

  return (
    <div className="group pt-2 pb-4 px-4 space-y-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <MessageBox>
            <div className="text-white/80 text-[13px] leading-[1.5] whitespace-pre-wrap break-words">
              {parsedContent.text}
            </div>
          </MessageBox>
        </div>

        {/*<MessageActions copied={copied} onCopy={handleCopy} />*/}
      </div>

      {imageBlocks.length > 0 && (
          <ImageAttachments images={imageBlocks} />
      )}

      {allContexts.length > 0 && <ContextPills context={allContexts} />}
    </div>
  );
};
