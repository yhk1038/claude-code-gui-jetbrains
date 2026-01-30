import React from 'react';
import { useStreaming, useChat } from '../hooks';
import { MessageList } from '../components';

/**
 * Example component demonstrating streaming message integration
 *
 * This shows how to:
 * 1. Use useStreaming hook for stream management
 * 2. Integrate with useChat hook
 * 3. Display messages with MessageList component
 * 4. Handle streaming state and UI updates
 */
export const StreamingExample: React.FC = () => {
  // Initialize chat hook
  const {
    messages,
    isStreaming,
    streamingMessageId,
    input,
    setInput,
    handleSubmit,
    retry,
  } = useChat({
    onStreamStart: (messageId) => {
      console.log('Stream started:', messageId);
    },
    onStreamEnd: (messageId) => {
      console.log('Stream ended:', messageId);
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  // Initialize streaming hook
  const {
    state: streamState,
    buffer,
    currentMessageId,
    isPaused,
    pause,
    resume,
    getBufferForMessage,
  } = useStreaming({
    throttleMs: 16, // 60fps
    onChunk: (chunk) => {
      console.log('Received chunk:', chunk);
    },
    onStateChange: (state) => {
      console.log('Stream state changed:', state);
    },
    onError: (error) => {
      console.error('Streaming error:', error);
    },
  });

  // Handle copy action
  const handleCopy = (content: string) => {
    console.log('Copied:', content.substring(0, 50) + '...');
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Streaming controls */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--ide-border)' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div>
            <strong>Stream State:</strong> {streamState}
          </div>
          <div>
            <strong>Is Streaming:</strong> {isStreaming ? 'Yes' : 'No'}
          </div>
          {currentMessageId && (
            <div>
              <strong>Current Message:</strong> {currentMessageId}
            </div>
          )}
          {isStreaming && (
            <button
              onClick={isPaused ? resume : pause}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--ide-accent)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          )}
        </div>
        {buffer && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.7 }}>
            <strong>Buffer size:</strong> {buffer.length} characters
          </div>
        )}
      </div>

      {/* Message list */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <MessageList
          messages={messages}
          streamingMessageId={streamingMessageId}
          onRetry={retry}
          onCopy={handleCopy}
        />
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: '1rem',
          borderTop: '1px solid var(--ide-border)',
          display: 'flex',
          gap: '0.5rem',
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요..."
          disabled={isStreaming}
          style={{
            flex: 1,
            padding: '0.75rem',
            border: '1px solid var(--ide-border)',
            borderRadius: '4px',
            background: 'var(--ide-bg)',
            color: 'var(--ide-fg)',
            fontFamily: 'var(--ide-font-ui)',
          }}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          style={{
            padding: '0.75rem 1.5rem',
            background: isStreaming || !input.trim() ? 'var(--ide-border)' : 'var(--ide-accent)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {isStreaming ? '전송 중...' : '전송'}
        </button>
      </form>

      {/* Debug info */}
      <div
        style={{
          padding: '0.5rem 1rem',
          background: 'rgba(0, 0, 0, 0.05)',
          fontSize: '0.75rem',
          fontFamily: 'var(--ide-font-code)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>Messages: {messages.length}</span>
        <span>Streaming: {streamingMessageId || 'None'}</span>
        <span>Buffer: {getBufferForMessage(currentMessageId || '').length} chars</span>
      </div>
    </div>
  );
};

// Mock data for testing
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
      content: `# React Hooks

React Hooks are functions that let you "hook into" React features from function components.

## Common Hooks

### useState
\`\`\`typescript
const [count, setCount] = useState(0);
\`\`\`

### useEffect
\`\`\`typescript
useEffect(() => {
  // Side effect here
  return () => {
    // Cleanup
  };
}, [dependencies]);
\`\`\`

### useContext
\`\`\`typescript
const value = useContext(MyContext);
\`\`\`

## Rules of Hooks
1. Only call hooks at the top level
2. Only call hooks from React functions`,
      timestamp: Date.now() - 59000,
      isStreaming: false,
    },
  ],
  streamChunks: [
    'React',
    ' Hooks',
    ' are',
    ' a',
    ' powerful',
    ' feature',
    '...',
  ],
};
