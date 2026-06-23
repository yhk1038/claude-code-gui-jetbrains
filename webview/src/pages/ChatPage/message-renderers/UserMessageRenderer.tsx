import React, { useMemo } from 'react';
import { LoadedMessageDto, getTextContent, isContentBlockArray } from '../../../types';
import type { ImageBlockDto } from '../../../dto/message/ContentBlockDto';
import { ContentBlockType } from '../../../dto/message/ContentBlockDto';
import { useCopyToClipboard } from './hooks/useCopyToClipboard';
import { ContextPills } from './components/ContextPills';
import { ImageAttachments } from './components/ImageAttachments';
import { MessageActions } from './components/MessageActions';
import { parseUserContent } from './utils/parseUserContent';
import { tokenizeMessagePaths } from './utils/tokenizeMessagePaths';
import { MessagePathChip } from './components/MessagePathChip';
import { InterruptedMessageRenderer } from './InterruptedMessageRenderer';
import { NotificationLine } from './NotificationMessageRenderer';
import { MessageBox } from './components/MessageBox';
import { useCliConfig } from '@/contexts/CliConfigContext';
import { modelChangeLabel } from '@/types/models';
import type { ModelInfo } from '@/types/slashCommand';

interface UserMessageRendererProps {
  message: LoadedMessageDto;
}

const INTERRUPTED_TEXT = '[Request interrupted by user]';
const INTERRUPTED_FOR_TOOL_USE_TEXT = '[Request interrupted by user for tool use]';

export const UserMessageRenderer: React.FC<UserMessageRendererProps> = ({ message }) => {
  const { copied, copy } = useCopyToClipboard();
  const { controlResponse } = useCliConfig();
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

  // A model change (we trigger it via set_model) surfaces as a `/model` command
  // output: live sends arrive as a local-command-stdout echo ("Set model to
  // <id>"); reloads replay the same change wrapped as a `/model` command entry.
  // Render BOTH as one centered notice with a friendly model label — never as a
  // left-side bubble and never split into two — so it reads identically live
  // and on reload.
  if (parsedContent.hasLocalCommandStdout || parsedContent.commandName === 'model') {
    const models: ModelInfo[] = controlResponse?.response?.response?.models ?? [];
    const label = modelChangeLabel(parsedContent.text, models);
    // Always render the echo at its correct chronological position. The matching
    // ephemeral local notification (added on model switch for instant feedback)
    // hides itself once this echo exists — see NotificationMessageRenderer — so
    // they converge to a single centered line at the right spot.
    if (label) {
      return <NotificationLine text={label} />;
    }
    // A `/model` entry with no parseable model line carries no useful text —
    // drop the redundant bubble rather than show an empty notice.
    if (parsedContent.commandName === 'model') {
      return null;
    }
  }

  // Render command-name style messages
  if (parsedContent.commandName) {
    return (
      <div className="group py-2 px-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <MessageBox>
              <div className="text-text-primary/80 text-[1rem] leading-relaxed whitespace-pre-wrap break-words">
                <span className="text-text-primary/50">{'/'}</span>{parsedContent.commandName}
                {parsedContent.text && (
                  <span className="text-text-primary/50">{' '}{parsedContent.text}</span>
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
            <div className="text-text-primary/80 text-[1rem] leading-[1.5] whitespace-pre-wrap break-words">
              {tokenizeMessagePaths(parsedContent.text).map((seg, idx) =>
                seg.isPath ? (
                  <MessagePathChip key={idx} token={seg.text} />
                ) : (
                  <React.Fragment key={idx}>{seg.text}</React.Fragment>
                ),
              )}
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
