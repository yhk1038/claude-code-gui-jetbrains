import { useMemo, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { ProjectSelectorPage } from '@/pages/ProjectSelectorPage';
import { useSessionContext } from '../../contexts/SessionContext';
import { useChatStreamContext } from '../../contexts/ChatStreamContext';
import { mergeToolResults } from './mergeToolResults';
import { StreamErrorBanner } from './StreamErrorBanner';
import './streaming.css';
import {StreamingIndicator} from "./StreamingIndicator/index.tsx";
import { EmptyState } from './EmptyState';
import { isJetBrains } from '@/config/environment';

interface Props {
  isStreaming: boolean;
}

export function ChatMessageArea(props: Props) {
  const { isStreaming } = props;
  const { workingDirectory } = useSessionContext();
  const { messages, retry: onRetry } = useChatStreamContext();
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll is driven entirely by ChatPage's single poll loop, which scrolls
  // the container directly — this component only renders the messages.

  // Merge tool_result user messages into preceding assistant's tool_use blocks
  const mergedMessages = useMemo(() => mergeToolResults(messages), [messages]);

  const isEmpty = mergedMessages.length === 0;

  // No working directory: show ProjectSelector or loading
  if (!workingDirectory) {
    // JetBrains JCEF 환경에서는 workingDir이 항상 제공되므로 이 분기에 도달하지 않음 (방어적 처리)
    if (isJetBrains()) {
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-text-tertiary text-sm">Loading working directory...</p>
        </div>
      );
    }
    return <ProjectSelectorPage />;
  }

  const log = () => {
    // console.log('messages', messages);
    // console.log('mergedMessages', mergedMessages)
  }

  // Empty state: no messages yet
  if (isEmpty) {
    return <EmptyState />;
  }

  // Render messages with widgets
  return (
    <div ref={containerRef} className="flex-1 text-xs" onClick={log}>
      {mergedMessages.map((message) => (
        <div key={message.uuid} onClick={() => console.log('message', message.uuid, message)}>
          <MessageBubble message={message} onRetry={onRetry} />
        </div>
      ))}
      {isStreaming && <StreamingIndicator />}
      <StreamErrorBanner />
    </div>
  );
}
