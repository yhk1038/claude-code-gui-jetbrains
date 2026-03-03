import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { SessionState } from '../types';
import { SessionMetaDto } from '../dto';
import { useBridgeContext } from './BridgeContext';
import { useApi } from './ApiContext';
import { getAdapter, onBridgeReady } from '../adapters';
import { toTitle } from '../mappers/sessionTransformer';


interface SessionContextValue {
  // State
  currentSessionId: string | null;
  currentSession: SessionMetaDto | null;
  sessions: SessionMetaDto[];
  sessionState: SessionState;
  isLoading: boolean;
  workingDirectory: string | null;

  // Actions
  setCurrentSessionId: (sessionId: string | null) => void;
  loadSessions: () => Promise<void>;
  resetToNewSession: () => void;
  openNewTab: () => void;
  openSettings: () => void;
  switchSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => void;
  addNewSession: (sessionId: string, firstPrompt: string) => void;
  setSessionState: (state: SessionState) => void;
  setWorkingDirectory: (dir: string | null) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const { subscribe, isConnected } = useBridgeContext();
  const api = useApi();

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionMetaDto[]>([]);
  const [sessionState, setSessionState] = useState<SessionState>(SessionState.Idle);
  const [isLoading, setIsLoading] = useState(false);
  const [workingDirectory, setWorkingDirectoryState] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('workingDir') || null;
  });

  // Update API workingDir when it changes
  const setWorkingDirectory = useCallback((dir: string | null) => {
    setWorkingDirectoryState(dir);
    if (dir) {
      api.setWorkingDir(dir);
      // Update URL with workingDir parameter
      const url = new URL(window.location.href);
      url.searchParams.set('workingDir', dir);
      window.history.replaceState({}, '', url.toString());
    } else {
      // Remove workingDir parameter if null
      const url = new URL(window.location.href);
      url.searchParams.delete('workingDir');
      window.history.replaceState({}, '', url.toString());
    }
  }, [api]);

  // Initialize API workingDir on mount
  useEffect(() => {
    if (workingDirectory) {
      api.setWorkingDir(workingDirectory);
    }
  }, [api, workingDirectory]);

  // JetBrains에서 kotlinBridgeReady 이벤트 후 IDE adapter 재초기화
  useEffect(() => {
    const handleBridgeReady = () => {
      onBridgeReady();
    };

    window.addEventListener('kotlinBridgeReady', handleBridgeReady);
    return () => window.removeEventListener('kotlinBridgeReady', handleBridgeReady);
  }, []);


  // loadSessions - using new API
  const loadSessions = useCallback(async () => {
    if (!isConnected) {
      console.log('[SessionContext] Not connected, cannot load sessions');
      return;
    }

    if (!workingDirectory) {
      console.log('[SessionContext] No working directory set, cannot load sessions');
      return;
    }

    try {
      setIsLoading(true);
      console.log('[SessionContext] Loading sessions from:', workingDirectory);

      const sessions = await api.sessions.index().then((sessions) => {
        return sessions
          .filter(s => !s.isSidechain)
          .sort((a, b) => {
            const aTime = a.updatedAt?.getTime() ?? 0;
            const bTime = b.updatedAt?.getTime() ?? 0;
            return bTime - aTime;
          });
      });
      setSessions(sessions);
      console.log('[SessionContext] Loaded CLI sessions:', sessions);
    } catch (error) {
      console.error('[SessionContext] Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, api.sessions, workingDirectory]);


  // Listen for state changes from Kotlin
  useEffect(() => {
    const unsubscribe = subscribe('STATE_CHANGE', (message) => {
      const state = message.payload?.state as SessionState;
      if (state) {
        setSessionState(state);
      }
    });
    return unsubscribe;
  }, [subscribe]);

  // Subscribe to SESSIONS_UPDATED for cross-tab session list sync
  useEffect(() => {
    const unsubscribe = subscribe('SESSIONS_UPDATED', (message) => {
      const { action, session } = message.payload as { action: string; session: { sessionId: string } };
      if (action === 'upsert' && session?.sessionId) {
        setSessions(prev => {
          const exists = prev.find(s => s.id === session.sessionId);
          if (exists) {
            return prev.map(s =>
              s.id === session.sessionId
                ? { ...s, updatedAt: new Date() }
                : s
            );
          }
          // 다른 탭에서 생성된 세션 — loadSessions로 전체 갱신
          loadSessions();
          return prev;
        });
      } else if (action === 'delete' && session?.sessionId) {
        setSessions(prev => prev.filter(s => s.id !== session.sessionId));
      }
    });
    return unsubscribe;
  }, [subscribe, loadSessions]);

  const resetToNewSession = useCallback(() => {
    setCurrentSessionId(null);
    setSessionState(SessionState.Idle);

    api.sessions.create().catch(error => {
      console.error('[SessionContext] Failed to clear CLI session:', error);
    });
  }, [api.sessions]);

  const openNewTab = useCallback(() => {
    // Use IDE adapter to open new tab
    // - JetBrains: Opens new editor tab via Kotlin bridge
    // - Browser: Opens new browser tab via window.open()
    // Note: Does NOT reset local state - current tab keeps its messages
    getAdapter().openNewTab().catch(error => {
      console.error('[SessionContext] Failed to open new tab:', error);
    });
  }, []);

  const openSettings = useCallback(() => {
    getAdapter().openSettings().catch(error => {
      console.error('[SessionContext] Failed to open settings:', error);
    });
  }, []);

  const switchSession = useCallback(async (sessionId: string) => {
    console.log('[SessionContext] switchSession called with:', sessionId);

    if (sessions.some(s => s.id === sessionId)) {
      setCurrentSessionId(sessionId);
      setSessionState(SessionState.Idle);

      try {
        // Triggers SESSION_LOADED event → AppProviders.SessionLoader handles message injection
        await api.sessions.load(sessionId);
        console.log('[SessionContext] Session load requested:', sessionId);
      } catch (error) {
        console.error('[SessionContext] Failed to load session:', error);
      }
    } else {
      console.warn('[SessionContext] Session not found in list:', sessionId);
    }
  }, [sessions, api.sessions]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await api.sessions.destroy(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setSessionState(SessionState.Idle);
      }
    } catch (error) {
      console.error('[SessionContext] Failed to delete session:', error);
    }
  }, [currentSessionId, api.sessions]);

  const renameSession = useCallback((sessionId: string, title: string) => {
    // Update local state only - CLI sessions are read-only
    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? { ...s, title, updatedAt: new Date() }
        : s
    ));
    // Note: CLI session titles cannot be modified from the plugin
  }, []);

  const addNewSession = useCallback((sessionId: string, firstPrompt: string) => {
    const now = new Date();
    const newSession = Object.assign(new SessionMetaDto(), {
      id: sessionId,
      title: toTitle(firstPrompt),
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      isSidechain: false,
    });
    setSessions(prev => [newSession, ...prev]);
  }, []);

  const currentSession = useMemo(() => {
    return sessions.find(s => s.id === currentSessionId) ?? null;
  }, [sessions, currentSessionId]);

  const value: SessionContextValue = {
    currentSessionId,
    currentSession,
    sessions,
    sessionState,
    isLoading,
    workingDirectory,
    setCurrentSessionId,
    loadSessions,
    resetToNewSession,
    openNewTab,
    openSettings,
    switchSession,
    deleteSession,
    renameSession,
    addNewSession,
    setSessionState,
    setWorkingDirectory,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
}
