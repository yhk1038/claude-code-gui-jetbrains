import React from 'react';
import { useChatStreamContext } from '../contexts/ChatStreamContext';

/**
 * Example component demonstrating streaming message integration
 * using the new ChatStreamContext.
 */
export const StreamingExample: React.FC = () => {
  const {
    messages,
    isStreaming,
    isStopped,
    streamingMessageId,
    input,
    setInput,
    handleSubmit,
    stop,
    continue: continueGeneration,
    error,
  } = useChatStreamContext();

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Status bar */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--ide-border)' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div>
            <strong>Streaming:</strong> {isStreaming ? 'Yes' : 'No'}
          </div>
          <div>
            <strong>Stopped:</strong> {isStopped ? 'Yes' : 'No'}
          </div>
          {streamingMessageId && (
            <div>
              <strong>Current Message:</strong> {streamingMessageId}
            </div>
          )}
          {isStreaming && (
            <button onClick={stop} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
              Stop
            </button>
          )}
          {isStopped && (
            <button onClick={continueGeneration} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
              Continue
            </button>
          )}
        </div>
        {error && (
          <div style={{ marginTop: '0.5rem', color: 'red' }}>
            Error: {error.message}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: '1rem' }}>
            <strong>{msg.role}:</strong> {typeof msg.content === 'string' ? msg.content : '[ContentBlocks]'}
            {msg.isStreaming && <span> (streaming...)</span>}
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ padding: '1rem', borderTop: '1px solid var(--ide-border)', display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요..."
          disabled={isStreaming}
          style={{ flex: 1, padding: '0.75rem' }}
        />
        <button type="submit" disabled={isStreaming || !input.trim()} style={{ padding: '0.75rem 1.5rem' }}>
          {isStreaming ? '전송 중...' : '전송'}
        </button>
      </form>

      {/* Debug */}
      <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
        <span>Messages: {messages.length}</span>
        <span>Streaming: {streamingMessageId || 'None'}</span>
      </div>
    </div>
  );
};

export const mockStreamingData = {
  messages: [
    {
      id: 'msg-1',
      role: 'user' as const,
      content: 'Hello! Can you explain React hooks?',
      timestamp: Date.now() - 60000,
    },
    {
      id: 'msg-2',
      role: 'assistant' as const,
      content: '# React Hooks\n\nReact Hooks are functions...',
      timestamp: Date.now() - 59000,
      isStreaming: false,
    },
  ],
};
