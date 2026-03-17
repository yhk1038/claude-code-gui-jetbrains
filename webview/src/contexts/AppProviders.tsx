import { ReactNode, useEffect, useRef } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { BridgeProvider, useBridgeContext } from './BridgeContext';
import { ApiProvider, useApiContext } from './ApiContext';
import { SessionProvider, useSessionContext } from './SessionContext';
import { ChatStreamProvider, useChatStreamContext } from './ChatStreamContext';
import { ThemeProvider } from './ThemeContext';
import { SettingsProvider } from './SettingsContext';
import { ClaudeSettingsProvider } from './ClaudeSettingsContext';
import { ChatInputFocusProvider } from './ChatInputFocusContext';
import { WorkingDirProvider } from './WorkingDirContext';
import { CommandPaletteProvider } from '../commandPalette/CommandPaletteProvider';
import { useApi } from './ApiContext';
import { SessionState } from '../types';
import type { LoadedMessageDto } from '../types';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * SessionLoader - Reactive session management driven by URL (SSOT)
 *
 * currentSessionId is derived from URL pathname in SessionContext.
 * This component reacts to currentSessionId changes and automatically:
 * 1. Clears previous session state (messages, tools, diffs)
 * 2. Loads new session messages from backend
 * 3. Guards against stale SESSION_LOADED responses
 *
 * Also handles:
 * - Loading session list on connect
 * - Reconnection recovery (isConnected false→true)
 * - Redirecting invalid session URLs
 */
function SessionLoader({ children }: { children: ReactNode }) {
  const { isConnected } = useApiContext();
  const { subscribe } = useBridgeContext();
  const api = useApi();
  const {
    loadSessions, sessions, currentSessionId, navigateToNewSession,
    isNewlyCreatedSession, setSessionState,
  } = useSessionContext();
  const { loadMessages, resetForSessionSwitch } = useChatStreamContext();

  // Ref to track currentSessionId for SESSION_LOADED validation (avoids stale closure)
  const currentSessionIdRef = useRef<string | null>(currentSessionId);
  currentSessionIdRef.current = currentSessionId;

  // Track previous values for change detection
  const prevSessionIdRef = useRef<string | null | undefined>(undefined); // undefined = not yet initialized
  const prevConnectedRef = useRef(false);

  // 1. Load session list on connect
  useEffect(() => {
    if (isConnected) {
      console.log('[SessionLoader] Bridge connected, loading sessions...');
      loadSessions();
    }
  }, [isConnected, loadSessions]);

  // 2. React to currentSessionId changes OR reconnection
  //    This is the CORE reactive effect — replaces manual orchestration in switchSession/resetToNewSession
  useEffect(() => {
    if (!isConnected) {
      prevConnectedRef.current = false;
      return;
    }

    const sessionChanged = prevSessionIdRef.current !== currentSessionId;
    const reconnected = !prevConnectedRef.current && prevSessionIdRef.current !== undefined;

    prevSessionIdRef.current = currentSessionId;
    prevConnectedRef.current = true;

    // Nothing to do if session didn't change and not reconnecting
    if (!sessionChanged && !reconnected) return;

    console.log('[SessionLoader] Session reaction:', {
      currentSessionId,
      sessionChanged,
      reconnected,
    });

    // Clear previous session state (messages, streaming, tools, diffs)
    // Skip reset for newly created sessions — their first user message was just
    // added by sendMessage and must be preserved; the state is already clean.
    if (!(currentSessionId && isNewlyCreatedSession(currentSessionId))) {
      resetForSessionSwitch();
    }
    setSessionState(SessionState.Idle);

    // Load session messages (skip for new/empty sessions and newly created sessions)
    if (currentSessionId && !isNewlyCreatedSession(currentSessionId)) {
      api.sessions.load(currentSessionId);
    }
  }, [currentSessionId, isConnected, resetForSessionSwitch, setSessionState, api.sessions, isNewlyCreatedSession]);

  // 3. Subscribe to SESSION_LOADED — with sessionId guard against stale responses
  useEffect(() => {
    return subscribe('SESSION_LOADED', (message) => {
      if (message.payload?.messages) {
        const rawMessages = message.payload.messages as LoadedMessageDto[];
        const sid = message.payload?.sessionId as string | undefined;

        // Guard: ignore stale responses from previously requested sessions
        if (sid && sid !== currentSessionIdRef.current) {
          console.log('[SessionLoader] Ignoring stale SESSION_LOADED for:', sid, '(current:', currentSessionIdRef.current, ')');
          return;
        }

        // Skip empty loads for newly created sessions — their first user message
        // hasn't been written to JSONL yet, so loading would wipe local state.
        if (sid && isNewlyCreatedSession(sid) && rawMessages.length === 0) {
          console.log('[SessionLoader] Skipping empty SESSION_LOADED for newly created session:', sid);
          return;
        }

        console.log('[SessionLoader] Session loaded, injecting raw messages:', rawMessages.length);
        loadMessages(rawMessages);
      }
    });
  }, [subscribe, loadMessages, isNewlyCreatedSession]);

  // 4. Validate session exists in list — redirect bad URLs
  useEffect(() => {
    if (!currentSessionId || sessions.length === 0) return;
    if (isNewlyCreatedSession(currentSessionId)) return;

    if (!sessions.some(s => s.id === currentSessionId)) {
      console.warn('[SessionLoader] Session from URL not found, redirecting:', currentSessionId);
      navigateToNewSession();
    }
  }, [currentSessionId, sessions, isNewlyCreatedSession, navigateToNewSession]);

  return <>{children}</>;
}

/**
 * Combined provider wrapper for the entire application.
 *
 * Hierarchy:
 * 1. BridgeProvider - Kotlin IPC bridge (foundation)
 * 2. BrowserRouter - react-router path-based routing
 * 3. ApiProvider - ClaudeCodeApi initialization (depends on Bridge)
 * 4. WorkingDirProvider - Working directory management (depends on Bridge + Api)
 * 5. SettingsProvider - IDE settings (terminal, theme, etc.) (depends on Bridge)
 * 6. ClaudeSettingsProvider - Claude Code settings (~/.claude/settings.json) (depends on Bridge)
 * 7. SessionProvider - Session management (depends on Bridge + WorkingDir + Settings)
 * 8. ChatStreamProvider - Chat state + Streaming + Diffs + Tools (depends on Bridge + Session)
 * 9. CommandPaletteProvider - Slash command manager (depends on ChatStream + Session)
 * 10. ThemeProvider - Theme management (depends on Settings)
 * 11. SessionLoader - Reactive session management (depends on Session + ChatStream + Api)
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <BridgeProvider>
      <BrowserRouter>
        <ApiProvider>
          <WorkingDirProvider>
            <SettingsProvider>
              <ClaudeSettingsProvider>
                <SessionProvider>
                  <ChatStreamProvider>
                    <CommandPaletteProvider>
                      <ThemeProvider>
                        <ChatInputFocusProvider>
                          <SessionLoader>{children}</SessionLoader>
                        </ChatInputFocusProvider>
                      </ThemeProvider>
                    </CommandPaletteProvider>
                  </ChatStreamProvider>
                </SessionProvider>
              </ClaudeSettingsProvider>
            </SettingsProvider>
          </WorkingDirProvider>
        </ApiProvider>
      </BrowserRouter>
    </BridgeProvider>
  );
}
