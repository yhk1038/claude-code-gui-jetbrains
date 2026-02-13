import { useEffect, useRef } from 'react';
import { Message } from '../types';
import { MessageBubble } from './MessageBubble';
import { ToolCard } from './ToolCard';
import { ProjectSelector } from './ProjectSelector';

interface ChatMessageAreaProps {
  messages: Message[];
  streamingMessageId: string | null;
  workingDirectory: string | null;
  onSelectProject: (path: string) => void;
  onRetry: (messageId: string) => void;
  approveToolUse: (toolId: string) => void;
  denyToolUse: (toolId: string) => void;
}

export function ChatMessageArea({
  messages,
  streamingMessageId: _streamingMessageId,
  workingDirectory,
  onSelectProject,
  onRetry,
  approveToolUse,
  denyToolUse,
}: ChatMessageAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or streaming updates
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, messages[messages.length - 1]?.content]);

  const isEmpty = messages.length === 0;

  // No working directory: show ProjectSelector or loading
  if (!workingDirectory) {
    // JetBrains에서는 kotlinBridge가 workingDirectory를 주입하므로 ProjectSelector 불필요
    if (window.kotlinBridge) {
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-zinc-500 text-sm">워킹 디렉토리를 불러오는 중...</p>
        </div>
      );
    }
    return <ProjectSelector onSelectProject={onSelectProject} />;
  }

  // Empty state: no messages yet
  if (isEmpty) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500 text-sm">메시지를 입력하세요</p>
      </div>
    );
  }

  // Render messages with widgets
  return (
    <div ref={containerRef} className="max-w-4xl mx-auto text-xs">
      {messages.map((message) => (
        <div key={message.id}>
          <MessageBubble message={message} onRetry={onRetry} />

          {/* Show tool cards for this message */}
          {message.toolUses?.map((toolUse) => (
            <div key={toolUse.id} className="px-6">
              <ToolCard
                toolUse={toolUse}
                onApprove={approveToolUse}
                onDeny={denyToolUse}
              />
            </div>
          ))}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
