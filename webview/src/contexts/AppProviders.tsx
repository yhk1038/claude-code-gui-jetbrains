import { ReactNode, useEffect, useRef } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import { BridgeProvider, useBridgeContext } from './BridgeContext';
import { ApiProvider, useApiContext } from './ApiContext';
import { SessionProvider, useSessionContext } from './SessionContext';
import { ChatStreamProvider, useChatStreamContext } from './ChatStreamContext';
import { ThemeProvider } from './ThemeContext';
import { Route, routeToPath, parseSessionIdFromPath, withWorkingDir } from '../router/routes';
import { SettingsProvider } from './SettingsContext';
import { ClaudeSettingsProvider } from './ClaudeSettingsContext';
import { ChatInputFocusProvider } from './ChatInputFocusContext';
import { CommandPaletteProvider } from '../commandPalette/CommandPaletteProvider';
import type { LoadedMessageDto } from '../types';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * SessionLoader - loadSessions를 bridge 연결 시점에 호출
 */
function SessionLoader({ children }: { children: ReactNode }) {
  const { isConnected } = useApiContext();
  const { subscribe } = useBridgeContext();
  const { loadSessions, switchSession, sessions, currentSessionId } = useSessionContext();
  const { loadMessages } = useChatStreamContext();
  const location = useLocation();
  const navigate = useNavigate();
  const urlSessionRestored = useRef(false);

  const sessionIdFromUrl = parseSessionIdFromPath(location.pathname);

  useEffect(() => {
    if (isConnected) {
      console.log('[AppProviders] Bridge connected, loading sessions...');
      loadSessions();
    }
  }, [isConnected, loadSessions]);

  // URL에 sessionId가 있으면 세션 목록 로드 후 해당 세션으로 전환
  useEffect(() => {
    if (urlSessionRestored.current || !sessionIdFromUrl || sessions.length === 0 || currentSessionId) return;

    urlSessionRestored.current = true;
    const sessionExists = sessions.some(s => s.id === sessionIdFromUrl);
    if (sessionExists) {
      console.log('[AppProviders] Restoring session from URL:', sessionIdFromUrl);
      switchSession(sessionIdFromUrl);
    } else {
      console.warn('[AppProviders] Session from URL not found, falling back to new session:', sessionIdFromUrl);
      navigate(withWorkingDir(routeToPath(Route.NEW_SESSION)), { replace: true });
    }
  }, [sessionIdFromUrl, sessions, currentSessionId, switchSession, navigate]);

  // Subscribe to SESSION_LOADED to load messages into chat
  // Raw JSONL entries are passed through - transformation is handled by useChatStream.loadMessages()
  useEffect(() => {
    return subscribe('SESSION_LOADED', (message) => {
      if (message.payload?.messages) {
        const rawMessages = message.payload.messages as LoadedMessageDto[];
        console.log('[AppProviders] Session loaded, injecting raw messages:', rawMessages.length, rawMessages);
        loadMessages(rawMessages);
      }
    });
  }, [subscribe, loadMessages]);

  return <>{children}</>;
}

/**
 * Combined provider wrapper for the entire application.
 *
 * Hierarchy:
 * 1. BridgeProvider - Kotlin IPC bridge (foundation)
 * 2. BrowserRouter - react-router path-based routing
 * 3. ApiProvider - ClaudeCodeApi initialization (depends on Bridge)
 * 4. SessionProvider - Session management (depends on Bridge)
 * 5. ChatStreamProvider - Chat state + Streaming + Diffs + Tools (depends on Bridge + Session)
 * 6. CommandPaletteProvider - 슬래시 커맨드 매니저 (depends on ChatStream + Session)
 * 7. ClaudeSettingsProvider - Claude Code settings (~/.claude/settings.json) (depends on Bridge)
 * 8. SettingsProvider - IDE settings (terminal, theme, etc.) (depends on Bridge)
 * 9. ThemeProvider - Theme management (independent)
 * 10. SessionLoader - Auto-load sessions when bridge connects
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <BridgeProvider>
      <BrowserRouter>
        <ApiProvider>
          <SessionProvider>
            <ChatStreamProvider>
              <CommandPaletteProvider>
                <ClaudeSettingsProvider>
                  <SettingsProvider>
                    <ThemeProvider>
                      <ChatInputFocusProvider>
                        <SessionLoader>{children}</SessionLoader>
                      </ChatInputFocusProvider>
                    </ThemeProvider>
                  </SettingsProvider>
                </ClaudeSettingsProvider>
              </CommandPaletteProvider>
            </ChatStreamProvider>
          </SessionProvider>
        </ApiProvider>
      </BrowserRouter>
    </BridgeProvider>
  );
}
