import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { BridgeProvider, useBridgeContext } from './BridgeContext';
import { ApiProvider, useApiContext } from './ApiContext';
import { SessionProvider, useSessionContext } from './SessionContext';
import { ChatStreamProvider, useChatStreamContext } from './ChatStreamContext';
import { ThemeProvider } from './ThemeContext';
import { SettingsProvider } from './SettingsContext';
import { ClaudeSettingsProvider } from './ClaudeSettingsContext';
import { AuthProvider } from './AuthContext';
import { CliConfigProvider } from './CliConfigContext';
import { ChatInputFocusProvider } from './ChatInputFocusContext';
import { ChatInputStateProvider } from './ChatInputStateContext';
import { WorkingDirProvider } from './WorkingDirContext';
import { CommandPaletteProvider } from '../commandPalette/CommandPaletteProvider';
import { useApi } from './ApiContext';
import { SessionState } from '../types';
import type { LoadedMessageDto } from '../types';
import { MessageType } from '@/shared';

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
    // Skip reset for:
    // - Newly created sessions: first user message was just added by sendMessage
    // - Reconnections: loadMessages will overwrite; clearing first causes flicker
    if (!reconnected && !(currentSessionId && isNewlyCreatedSession(currentSessionId))) {
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
    return subscribe(MessageType.SESSION_LOADED, (message) => {
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

        console.log('[SessionLoader] Session loaded, injecting raw messages:', rawMessages);
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
 * 5. CliConfigProvider - CLI config (control_response) cache (depends on Bridge + WorkingDir)
 * 6. SettingsProvider - IDE settings (terminal, theme, etc.) (depends on Bridge)
 * 7. ClaudeSettingsProvider - Claude Code settings (~/.claude/settings.json) (depends on Bridge)
 * 8. SessionProvider - Session management (depends on Bridge + WorkingDir + Settings)
 * 9. ChatStreamProvider - Chat state + Streaming + Diffs + Tools (depends on Bridge + Session)
 * 10. CommandPaletteProvider - Slash command manager (depends on ChatStream + Session)
 * 11. ThemeProvider - Theme management (depends on Settings)
 * 12. SessionLoader - Reactive session management (depends on Session + ChatStream + Api)
 */

interface ChatProviderBridgeProps {
  children: ReactNode;
}

/**
 * Bridges ChatInputStateProvider and ChatStreamProvider as siblings.
 *
 * ChatStreamProvider must NOT be nested inside ChatInputStateProvider —
 * otherwise every keystroke (which triggers ChatInputStateProvider re-render)
 * would propagate into ChatStreamProvider and all its consumers
 * (MessageBubble, ChatMessageArea, etc.), causing the keystroke lag described
 * in #31.
 *
 * The shared inputRef + setInputCallbackRef let ChatStreamProvider read/clear
 * input without subscribing to ChatInputStateContext.
 */
function ChatProviderBridge(props: ChatProviderBridgeProps) {
  const { children } = props;
  const inputRef = useRef('');
  const setInputCallbackRef = useRef<(value: string) => void>(() => {});

  const setInput = useCallback((value: string) => {
    setInputCallbackRef.current(value);
  }, []);

  return (
    <ChatStreamProvider setInput={setInput} inputRef={inputRef}>
      <ChatInputStateProvider
        inputRef={inputRef}
        setInputCallbackRef={setInputCallbackRef}
      >
        <CommandPaletteProvider>
          <ThemeProvider>
            <ChatInputFocusProvider>
              <SessionLoader>{children}</SessionLoader>
            </ChatInputFocusProvider>
          </ThemeProvider>
        </CommandPaletteProvider>
      </ChatInputStateProvider>
    </ChatStreamProvider>
  );
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <BridgeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ApiProvider>
            <WorkingDirProvider>
              <CliConfigProvider>
              <SettingsProvider>
                <ClaudeSettingsProvider>
                  <AuthProvider>
                    <SessionProvider>
                      <ChatProviderBridge>{children}</ChatProviderBridge>
                    </SessionProvider>
                  </AuthProvider>
                </ClaudeSettingsProvider>
              </SettingsProvider>
            </CliConfigProvider>
            </WorkingDirProvider>
          </ApiProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </BridgeProvider>
  );
}
