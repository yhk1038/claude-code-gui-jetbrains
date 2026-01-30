import { createContext, useContext, ReactNode, useEffect, useCallback } from 'react';
import { useChat } from '../hooks/useChat';
import { useDiffs } from '../hooks/useDiffs';
import { useTools } from '../hooks/useTools';
import { useBridgeContext } from './BridgeContext';
import { useSessionContext } from './SessionContext';
import { Context } from '../types';

interface ChatContextType {
  chat: ReturnType<typeof useChat>;
  diffs: ReturnType<typeof useDiffs>;
  tools: ReturnType<typeof useTools>;
  sendMessageWithContext: (content: string, context?: Context[]) => void;
  stop: () => void;
  continue: () => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const bridge = useBridgeContext();
  const session = useSessionContext();

  const chat = useChat({
    onStreamStart: (_messageId) => {
      session.setSessionState('streaming');
    },
    onStreamEnd: (_messageId) => {
      session.setSessionState('idle');
    },
    onError: (error) => {
      console.error('Chat error:', error);
      session.setSessionState('error');
    },
  });

  const diffs = useDiffs();
  const tools = useTools();

  // Listen for streaming messages from Kotlin
  useEffect(() => {
    const unsubscribes = [
      bridge.subscribe('STREAM_DELTA', (message) => {
        const delta = message.payload?.delta as string;
        if (delta) {
          chat.appendToStreamingMessage(delta);
        }
      }),
      bridge.subscribe('STREAM_END', () => {
        // Stream complete, finalize message
        if (chat.streamingMessageId) {
          chat.updateMessage(chat.streamingMessageId, { isStreaming: false });
        }
        session.setSessionState('idle');
      }),
      bridge.subscribe('TOOL_USE', (message) => {
        const toolUse = message.payload;
        tools.addToolUse(toolUse as any);
        session.setSessionState('waiting_permission');
      }),
      bridge.subscribe('DIFF_PROPOSED', (message) => {
        const diff = message.payload;
        diffs.addDiff(diff as any);
        session.setSessionState('has_diff');
      }),
      bridge.subscribe('ERROR', (message) => {
        const error = message.payload?.error as string;
        console.error('Bridge error:', error);
        session.setSessionState('error');
      }),
    ];

    return () => unsubscribes.forEach(unsub => unsub());
  }, [bridge, chat, diffs, tools, session]);

  // Send message with bridge communication
  const sendMessageWithContext = useCallback((content: string, context?: Context[]) => {
    chat.sendMessage(content, context);
    bridge.send('SEND_MESSAGE', { content, context: context || [] });
  }, [chat, bridge]);

  // Stop streaming
  const stop = useCallback(() => {
    chat.stop();
    bridge.send('STOP_STREAMING', {});
  }, [chat, bridge]);

  // Continue streaming
  const continueStreaming = useCallback(() => {
    chat.continue();
    bridge.send('CONTINUE', {});
  }, [chat, bridge]);

  const value: ChatContextType = {
    chat,
    diffs,
    tools,
    sendMessageWithContext,
    stop,
    continue: continueStreaming,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
