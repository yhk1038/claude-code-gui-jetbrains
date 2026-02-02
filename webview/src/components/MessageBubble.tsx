import { Message } from '../types';
import {
  UserMessageRenderer,
  AssistantMessageRenderer,
  SystemMessageRenderer,
} from './message-renderers';

interface MessageBubbleProps {
  message: Message;
  onRetry?: (messageId: string) => void;
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  switch (message.role) {
    case 'user':
      return <UserMessageRenderer message={message} />;
    case 'assistant':
      return <AssistantMessageRenderer message={message} onRetry={onRetry} />;
    case 'system':
      return <SystemMessageRenderer message={message} />;
    default:
      return null;
  }
}
