import { ReactNode, useEffect } from 'react';
import { BridgeProvider, useBridgeContext } from './BridgeContext';
import { SessionProvider, useSessionContext } from './SessionContext';
import { ChatProvider, useChatContext } from './ChatContext';
import { ThemeProvider } from './ThemeContext';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * SessionLoader - loadSessions를 bridge 연결 시점에 호출
 */
function SessionLoader({ children }: { children: ReactNode }) {
  const { isConnected, subscribe } = useBridgeContext();
  const { loadSessions } = useSessionContext();
  const { chat } = useChatContext();

  useEffect(() => {
    if (isConnected) {
      console.log('[AppProviders] Bridge connected, loading sessions...');
      loadSessions();
    }
  }, [isConnected, loadSessions]);

  // Subscribe to SESSION_LOADED to load messages into chat
  useEffect(() => {
    return subscribe('SESSION_LOADED', (message) => {
      if (message.payload?.messages) {
        const messages = message.payload.messages as Array<{
          role: 'user' | 'assistant';
          content: string;
          timestamp: string;
        }>;
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
 * 2. SessionProvider - Session management (depends on Bridge)
 * 3. ChatProvider - Chat state + Diffs + Tools (depends on Bridge + Session)
 * 4. ThemeProvider - Theme management (independent)
 * 5. SessionLoader - Auto-load sessions when bridge connects
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <BridgeProvider>
      <SessionProvider>
        <ChatProvider>
          <ThemeProvider>
            <SessionLoader>{children}</SessionLoader>
          </ThemeProvider>
        </ChatProvider>
      </SessionProvider>
    </BridgeProvider>
  );
}
