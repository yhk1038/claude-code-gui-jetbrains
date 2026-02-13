import { createContext, useContext, ReactNode, useEffect, useCallback, useState, useRef } from 'react';
import { useChatStream, LoadedMessage } from '../hooks/useChatStream';
import { useDiffs } from '../hooks/useDiffs';
import { useTools } from '../hooks/useTools';
import { useBridgeContext } from './BridgeContext';
import { useSessionContext } from './SessionContext';
import { Message, Context } from '../types';

interface ChatStreamContextType {
  // From useChatStream
  messages: Message[];
  isStreaming: boolean;
  isStopped: boolean;
  streamingMessageId: string | null;
  error: Error | null;

  // Local input state
  input: string;
  setInput: (input: string) => void;

  // Actions
  sendMessage: (content: string, context?: Context[]) => void;
  handleSubmit: (e?: React.FormEvent) => void;
  stop: () => void;
  continue: () => void;
  retry: (messageId: string) => void;

  // From useChatStream (message manipulation)
  clearMessages: () => void;
  loadMessages: (msgs: LoadedMessage[]) => void;
  appendMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;

  // Subsystems (preserved)
  tools: ReturnType<typeof useTools>;
  diffs: ReturnType<typeof useDiffs>;
}

const ChatStreamContext = createContext<ChatStreamContextType | undefined>(undefined);

export function useChatStreamContext() {
  const context = useContext(ChatStreamContext);
  if (!context) {
    throw new Error('useChatStreamContext must be used within a ChatStreamProvider');
  }
  return context;
}

interface ChatStreamProviderProps {
  children: ReactNode;
}

export function ChatStreamProvider({ children }: ChatStreamProviderProps) {
  const bridge = useBridgeContext();
  const session = useSessionContext();
  const tools = useTools();
  const diffs = useDiffs();

  const [input, setInput] = useState('');

  // Initialize useChatStream with bridge and callbacks
  const chatStream = useChatStream({
    bridge: {
      isConnected: bridge.isConnected,
      send: bridge.send,
      subscribe: bridge.subscribe,
    },
    onStreamStart: (messageId: string) => {
      console.log('[ChatStreamContext] Stream started:', messageId);
      session.setSessionState('streaming');
    },
    onStreamEnd: (messageId: string) => {
      console.log('[ChatStreamContext] Stream ended:', messageId);
      session.setSessionState('idle');
    },
    onError: (error: Error) => {
      console.error('[ChatStreamContext] Stream error:', error);
      session.setSessionState('error');
    },
    onSystemMessage: (data: { sessionId: string; content: unknown }) => {
      console.log('[ChatStreamContext] System message:', data);
    },
  });

  // ref로 안정화 (useEffect 의존성 churn 방지)
  const toolsRef = useRef(tools);
  const diffsRef = useRef(diffs);
  const sessionRef = useRef(session);
  toolsRef.current = tools;
  diffsRef.current = diffs;
  sessionRef.current = session;

  // Subscribe to bridge events for tools and diffs
  useEffect(() => {
    if (!bridge.isConnected) return;

    const unsubscribeToolUse = bridge.subscribe('TOOL_USE', (message: IPCMessage) => {
      console.log('[ChatStreamContext] TOOL_USE received:', message.payload);
      toolsRef.current.addToolUse(message.payload as any);
      sessionRef.current.setSessionState('waiting_permission');
    });

    const unsubscribeDiff = bridge.subscribe('DIFF_PROPOSED', (message: IPCMessage) => {
      console.log('[ChatStreamContext] DIFF_PROPOSED received:', message.payload);
      diffsRef.current.addDiff(message.payload as any);
      sessionRef.current.setSessionState('has_diff');
    });

    return () => {
      unsubscribeToolUse();
      unsubscribeDiff();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.isConnected, bridge.subscribe]);

  // sendMessage: add to local state + send to Kotlin + create session if needed
  const sendMessage = useCallback(
    (content: string, context?: Context[]) => {
      // Add to local chat state
      chatStream.addUserMessage(content, context);

      // Send to Kotlin bridge
      bridge.send('SEND_MESSAGE', {
        content,
        context: context || [],
      }).then((response) => {
        if (response?.status === 'error') {
          console.error('[ChatStreamContext] Kotlin error:', response.error);
        }
      }).catch((error) => {
        console.error('[ChatStreamContext] Failed to send message to bridge:', error);
      });

      // Create session if no current session exists
      if (!session.currentSessionId) {
        console.log('[ChatStreamContext] Creating new session with message');
        session.createSessionWithMessage(content);
      }
    },
    [chatStream, bridge, session]
  );

  // handleSubmit: convenience wrapper for form submission
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }

      const trimmedInput = input.trim();
      if (!trimmedInput) return;

      sendMessage(trimmedInput);
      setInput('');
    },
    [input, sendMessage]
  );

  // stop: stop streaming locally + send STOP_SESSION to Kotlin + set idle state
  const stop = useCallback(() => {
    console.log('[ChatStreamContext] Stopping session');

    // Stop local streaming
    chatStream.stop();

    // Send stop signal to Kotlin (correct handler: STOP_SESSION, not STOP_STREAMING)
    bridge.send('STOP_SESSION', {}).catch((error) => {
      console.error('[ChatStreamContext] Failed to stop session:', error);
    });

    // Set session state to idle
    session.setSessionState('idle');
  }, [chatStream, bridge, session]);

  // continue: continue generation locally (no Kotlin handler exists)
  const continueGeneration = useCallback(() => {
    console.log('[ChatStreamContext] Continuing generation (local only)');

    // Continue local streaming
    chatStream.continue();

    // Note: No Kotlin handler exists for CONTINUE, so just local state change
  }, [chatStream]);

  // retry: delegate to chatStream
  const retry = useCallback(
    (messageId: string) => {
      console.log('[ChatStreamContext] Retrying message:', messageId);
      chatStream.retry(messageId);
    },
    [chatStream]
  );

  const contextValue: ChatStreamContextType = {
    // From useChatStream
    messages: chatStream.messages,
    isStreaming: chatStream.isStreaming,
    isStopped: chatStream.isStopped,
    streamingMessageId: chatStream.streamingMessageId,
    error: chatStream.error,

    // Local input state
    input,
    setInput,

    // Actions
    sendMessage,
    handleSubmit,
    stop,
    continue: continueGeneration,
    retry,

    // Message manipulation
    clearMessages: chatStream.clearMessages,
    loadMessages: chatStream.loadMessages,
    appendMessage: chatStream.appendMessage,
    updateMessage: chatStream.updateMessage,

    // Subsystems
    tools,
    diffs,
  };

  return (
    <ChatStreamContext.Provider value={contextValue}>
      {children}
    </ChatStreamContext.Provider>
  );
}
