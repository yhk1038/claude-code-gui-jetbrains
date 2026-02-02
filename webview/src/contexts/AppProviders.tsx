import { ReactNode, useEffect } from 'react';
import { BridgeProvider, useBridgeContext } from './BridgeContext';
import { ApiProvider, useApiContext } from './ApiContext';
import { SessionProvider, useSessionContext } from './SessionContext';
import { ChatProvider, useChatContext } from './ChatContext';
import { ThemeProvider } from './ThemeContext';
import { getTextContent, isContentBlockArray } from '../types';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * SessionLoader - loadSessions를 bridge 연결 시점에 호출
 */
function SessionLoader({ children }: { children: ReactNode }) {
  const { isConnected } = useApiContext();
  const { subscribe } = useBridgeContext();
  const { loadSessions } = useSessionContext();
  const { chat } = useChatContext();

  useEffect(() => {
    if (isConnected) {
      console.log('[AppProviders] Bridge connected, loading sessions...');
      loadSessions();
    }
  }, [isConnected, loadSessions]);

  // Subscribe to SESSION_LOADED to load messages into chat
  // Now handles both legacy string content and new ContentBlock array
  useEffect(() => {
    return subscribe('SESSION_LOADED', (message) => {
      if (message.payload?.messages) {
        const rawMessages = message.payload.messages as Array<{
          type?: string;
          role?: 'user' | 'assistant';
          content: string | unknown[];
          timestamp: string;
        }>;

        // Transform messages to support both formats
        const messages = rawMessages.map((msg) => {
          const role = msg.role || (msg.type === 'assistant' ? 'assistant' : 'user');
          // Extract text content if it's a ContentBlock array
          const content = isContentBlockArray(msg.content)
            ? getTextContent({ content: msg.content } as any)
            : (msg.content as string);

          return {
            role: role as 'user' | 'assistant',
            content,
            timestamp: msg.timestamp,
            // Preserve original content for advanced rendering
            originalContent: msg.content,
          };
        });

        console.log('[AppProviders] Session loaded, injecting messages:', messages.length);
        chat.loadMessages(messages);
      }
    });
  }, [subscribe, chat]);

  return <>{children}</>;
}

/**
 * Combined provider wrapper for the entire application.
 *
 * Hierarchy:
 * 1. BridgeProvider - Kotlin IPC bridge (foundation)
 * 2. ApiProvider - ClaudeCodeApi initialization (depends on Bridge)
 * 3. SessionProvider - Session management (depends on Bridge)
 * 4. ChatProvider - Chat state + Diffs + Tools (depends on Bridge + Session)
 * 5. ThemeProvider - Theme management (independent)
 * 6. SessionLoader - Auto-load sessions when bridge connects
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <BridgeProvider>
      <ApiProvider>
        <SessionProvider>
          <ChatProvider>
            <ThemeProvider>
              <SessionLoader>{children}</SessionLoader>
            </ThemeProvider>
          </ChatProvider>
        </SessionProvider>
      </ApiProvider>
    </BridgeProvider>
  );
}
