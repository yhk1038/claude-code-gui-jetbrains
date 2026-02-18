import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { LoadedMessageDto, getTextContent, getToolUses } from '../types';
import { StreamingMessage } from './StreamingMessage';

interface MessageListProps {
  messages: LoadedMessageDto[];
  streamingMessageId: string | null;
  className?: string;
  onRetry?: (messageId: string) => void;
  onCopy?: (content: string) => void;
}

interface MessageGroup {
  date: string;
  messages: LoadedMessageDto[];
}

// const VIRTUAL_SCROLL_THRESHOLD = 50; // Start virtual scrolling after 50 messages
// const MESSAGE_HEIGHT = 100; // Estimated average message height
// const BUFFER_SIZE = 5; // Number of messages to render above/below viewport

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  streamingMessageId,
  className = '',
  onRetry,
  onCopy,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const lastScrollTop = useRef(0);
  const scrollTimeout = useRef<number | null>(null);

  // Group messages by date
  const messageGroups = useMemo(() => {
    const groups: MessageGroup[] = [];
    let currentGroup: MessageGroup | null = null;

    messages.forEach((message) => {
      const timestampNum = typeof message.timestamp === 'string' ? new Date(message.timestamp).getTime() : (message.timestamp ?? Date.now());
      const date = formatDate(timestampNum);

      if (!currentGroup || currentGroup.date !== date) {
        currentGroup = { date, messages: [] };
        groups.push(currentGroup);
      }

      currentGroup.messages.push(message);
    });

    return groups;
  }, [messages]);

  // Check if container is near bottom
  const checkIfNearBottom = useCallback(() => {
    if (!containerRef.current) return false;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    return distanceFromBottom < 100; // Within 100px of bottom
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop } = containerRef.current;
    const isScrollingDown = scrollTop > lastScrollTop.current;
    lastScrollTop.current = scrollTop;

    // Update near-bottom status
    const nearBottom = checkIfNearBottom();
    setIsNearBottom(nearBottom);

    // Detect user scrolling (scrolling up or away from bottom)
    if (!isScrollingDown && !nearBottom) {
      setIsUserScrolling(true);
    }

    // Clear existing timeout
    if (scrollTimeout.current) {
      window.clearTimeout(scrollTimeout.current);
    }

    // Reset user scrolling flag after 2 seconds of no scrolling
    scrollTimeout.current = window.setTimeout(() => {
      if (checkIfNearBottom()) {
        setIsUserScrolling(false);
      }
    }, 2000);
  }, [checkIfNearBottom]);

  // Auto-scroll to bottom when new messages arrive (if user hasn't scrolled up)
  useEffect(() => {
    if (!isUserScrolling && streamingMessageId) {
      scrollToBottom('smooth');
    }
  }, [messages, streamingMessageId, isUserScrolling]);

  // Scroll to bottom on mount
  useEffect(() => {
    scrollToBottom('auto');
  }, []);

  // Scroll to bottom function
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (scrollAnchorRef.current) {
      scrollAnchorRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  }, []);

  // Handle retry button click
  const handleRetry = useCallback((messageId: string) => {
    onRetry?.(messageId);
  }, [onRetry]);

  // Handle copy button click
  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      onCopy?.(content);
    }).catch((err) => {
      console.error('Failed to copy:', err);
    });
  }, [onCopy]);

  // Render a single message
  const renderMessage = useCallback((message: LoadedMessageDto) => {
    const isStreaming = message.uuid === streamingMessageId;
    const isAssistant = message.type === 'assistant';
    const isUser = message.type === 'user';

    return (
      <div
        key={message.uuid}
        className={`message ${message.type} ${isStreaming ? 'streaming' : ''}`}
      >
        <div className="message-header">
          <div className="message-role">
            {isUser ? (
              <span className="role-icon user-icon">👤</span>
            ) : isAssistant ? (
              <span className="role-icon assistant-icon">🤖</span>
            ) : (
              <span className="role-icon system-icon">ℹ️</span>
            )}
            <span className="role-text">{capitalizeFirst(message.type)}</span>
          </div>
          <div className="message-timestamp">
            {formatTime(typeof message.timestamp === 'string' ? new Date(message.timestamp).getTime() : (message.timestamp as any))}
          </div>
        </div>

        <div className="message-content">
          {isAssistant ? (
            <StreamingMessage
              content={getTextContent(message)}
              isStreaming={isStreaming}
            />
          ) : (
            <div className="user-content">
              {getTextContent(message)}
            </div>
          )}

          {message.context && message.context.length > 0 && (
            <div className="message-context">
              <div className="context-header">Context:</div>
              {message.context.map((ctx, idx) => (
                <div key={idx} className="context-item">
                  <span className="context-type">{ctx.type}</span>
                  {ctx.path && <span className="context-path">{ctx.path}</span>}
                </div>
              ))}
            </div>
          )}

          {(() => {
            const toolUses = getToolUses(message);
            return toolUses.length > 0 ? (
              <div className="tool-uses">
                {toolUses.map((tool) => (
                  <div key={tool.id} className={`tool-use ${tool.status}`}>
                    <div className="tool-name">{tool.name}</div>
                    <div className="tool-status">{tool.status}</div>
                  </div>
                ))}
              </div>
            ) : null;
          })()}
        </div>

        <div className="message-actions">
          {isAssistant && !isStreaming && (
            <>
              <button
                className="action-btn copy-btn"
                onClick={() => handleCopy(getTextContent(message))}
                title="Copy"
              >
                📋
              </button>
              <button
                className="action-btn retry-btn"
                onClick={() => handleRetry(message.uuid!)}
                title="Retry"
              >
                🔄
              </button>
            </>
          )}
        </div>
      </div>
    );
  }, [streamingMessageId, handleRetry, handleCopy]);

  return (
    <div
      ref={containerRef}
      className={`message-list ${className}`}
      onScroll={handleScroll}
    >
      {messageGroups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <div className="empty-text">대화를 시작해보세요</div>
        </div>
      ) : (
        <>
          {messageGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="message-group">
              <div className="date-divider">
                <span className="date-text">{group.date}</span>
              </div>
              {group.messages.map((message) => renderMessage(message))}
            </div>
          ))}
        </>
      )}

      <div ref={scrollAnchorRef} className="scroll-anchor" />

      {!isNearBottom && (
        <button
          className="scroll-to-bottom-btn"
          onClick={() => scrollToBottom('smooth')}
          title="Scroll to bottom"
        >
          ↓
        </button>
      )}

      <style>{`
        .message-list {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 1rem;
          gap: 1rem;
          scroll-behavior: smooth;
        }

        .message-list::-webkit-scrollbar {
          width: 8px;
        }

        .message-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .message-list::-webkit-scrollbar-thumb {
          background: rgba(127, 127, 127, 0.3);
          border-radius: 4px;
        }

        .message-list::-webkit-scrollbar-thumb:hover {
          background: rgba(127, 127, 127, 0.5);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 1rem;
          opacity: 0.5;
        }

        .empty-icon {
          font-size: 3rem;
        }

        .empty-text {
          font-size: 1.1rem;
          color: var(--ide-fg);
        }

        .message-group {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .date-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 1rem 0;
          position: relative;
        }

        .date-divider::before,
        .date-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--ide-border);
        }

        .date-text {
          padding: 0 1rem;
          font-size: 0.85rem;
          color: rgba(127, 127, 127, 0.7);
          white-space: nowrap;
        }

        .message {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem;
          border-radius: 8px;
          background: rgba(127, 127, 127, 0.05);
          transition: background-color 0.2s;
          position: relative;
        }

        .message:hover {
          background: rgba(127, 127, 127, 0.08);
        }

        .message:hover .message-actions {
          opacity: 1;
        }

        .message.streaming {
          background: rgba(96, 165, 250, 0.05);
        }

        .message.user {
          background: rgba(96, 165, 250, 0.1);
        }

        .message-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .message-role {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .role-icon {
          font-size: 1.2rem;
        }

        .message-timestamp {
          font-size: 0.8rem;
          color: rgba(127, 127, 127, 0.7);
        }

        .message-content {
          flex: 1;
          min-width: 0;
        }

        .user-content {
          white-space: pre-wrap;
          word-wrap: break-word;
          line-height: 1.6;
        }

        .message-context {
          margin-top: 1rem;
          padding: 0.75rem;
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
          font-size: 0.85rem;
        }

        .context-header {
          font-weight: 600;
          margin-bottom: 0.5rem;
          opacity: 0.8;
        }

        .context-item {
          display: flex;
          gap: 0.5rem;
          margin: 0.25rem 0;
          opacity: 0.7;
        }

        .context-type {
          font-weight: 500;
          color: var(--ide-accent);
        }

        .context-path {
          font-family: var(--ide-font-code);
          font-size: 0.85em;
        }

        .tool-uses {
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .tool-use {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem;
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
          font-size: 0.85rem;
        }

        .tool-name {
          font-family: var(--ide-font-code);
          font-weight: 500;
        }

        .tool-status {
          font-size: 0.8rem;
          padding: 0.2rem 0.5rem;
          border-radius: 3px;
          background: rgba(127, 127, 127, 0.2);
        }

        .tool-use.completed .tool-status {
          background: var(--ide-success);
          color: white;
        }

        .tool-use.failed .tool-status {
          background: var(--ide-error);
          color: white;
        }

        .tool-use.pending .tool-status {
          background: var(--ide-warning);
          color: white;
        }

        .message-actions {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          display: flex;
          gap: 0.25rem;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .action-btn {
          padding: 0.25rem 0.5rem;
          background: rgba(0, 0, 0, 0.2);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1rem;
          transition: background 0.2s;
        }

        .action-btn:hover {
          background: rgba(0, 0, 0, 0.3);
        }

        .scroll-anchor {
          height: 1px;
        }

        .scroll-to-bottom-btn {
          position: fixed;
          bottom: 1rem;
          right: 1rem;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--ide-accent);
          color: white;
          border: none;
          cursor: pointer;
          font-size: 1.5rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: transform 0.2s, opacity 0.2s;
          opacity: 0.9;
        }

        .scroll-to-bottom-btn:hover {
          transform: scale(1.1);
          opacity: 1;
        }

        .scroll-to-bottom-btn:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
};

// Helper functions

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) {
    return '오늘';
  } else if (isSameDay(date, yesterday)) {
    return '어제';
  } else {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
