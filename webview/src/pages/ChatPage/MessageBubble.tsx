import { memo } from 'react';
import { LoadedMessageDto } from '../../types';
import {
  UserMessageRenderer,
  AssistantMessageRenderer,
  SystemMessageRenderer,
  SummaryMessageRenderer,
  NotificationMessageRenderer,
} from './message-renderers';

interface MessageBubbleProps {
  message: LoadedMessageDto;
  onRetry?: (messageId: string) => void;
}

// React.memo skips re-rendering when props (message identity, onRetry) are
// unchanged. ChatMessageArea must clone any objects it modifies — otherwise
// in-place mutation defeats this bailout.
export const MessageBubble = memo(function MessageBubble(props: MessageBubbleProps) {
  const { message, onRetry } = props;
  switch (message.type) {
    case 'user':
      return <UserMessageRenderer message={message} />;
    case 'assistant':
      return <AssistantMessageRenderer message={message} onRetry={onRetry} />;
    case 'system':
      return <SystemMessageRenderer message={message} />;
    case 'summary':
      return <SummaryMessageRenderer message={message} />;
    case 'notification':
      return <NotificationMessageRenderer message={message} />;
    default:
      return null;
  }
});
