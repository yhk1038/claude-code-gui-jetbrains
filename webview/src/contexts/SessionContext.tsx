import React, { createContext, useContext, useState, useCallback, useRef, useMemo, ReactNode } from 'react';
import { SessionState, LoadedMessageDto } from '../types';
import { SessionMetaDto } from '../dto';
import { useBridgeContext } from './BridgeContext';
import { useApi } from './ApiContext';
import { getAdapter, onBridgeReady } from '../adapters';

declare global {
  interface Window {
    workingDirectory?: string;
  }
}

interface SessionContextValue {
  // State
  currentSessionId: string | null;
  currentSession: SessionMetaDto | null;
  sessions: SessionMetaDto[];
  sessionState: SessionState;
  isLoading: boolean;
  workingDirectory: string | null;

  // Actions
  loadSessions: () => Promise<void>;
  resetToNewSession: () => void;
  openNewTab: () => void;
  openSettings: () => void;
  createSessionWithMessage: (firstMessage: string) => { sessionId: string; title: string };
  switchSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => void;
  setSessionState: (state: SessionState) => void;
  saveMessages: (messages: LoadedMessageDto[]) => void;
  setWorkingDirectory: (dir: string | null) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: ReactNode;
  onSessionChange?: (sessionId: string) => void;
}

export function SessionProvider({ children, onSessionChange }: SessionProviderProps) {
  const { subscribe, isConnected } = useBridgeContext();
  const api = useApi();

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionMetaDto[]>([]);
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [workingDirectory, setWorkingDirectoryState] = useState<string | null>(() => {
    // 1순위: JetBrains가 주입한 값
    // 2순위: URL 파라미터 (브라우저에서 직접 접근 시)
    const params = new URLSearchParams(window.location.search);
    return window.workingDirectory || params.get('workingDir') || null;
  });

  const messagesRef = useRef<LoadedMessageDto[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  React.useEffect(() => {
    if (workingDirectory) {
      api.setWorkingDir(workingDirectory);
    }
  }, [api, workingDirectory]);

  // JetBrains에서 kotlinBridgeReady 이벤트 후 workingDirectory 주입 감지
  React.useEffect(() => {
    const handleBridgeReady = () => {
      // Re-initialize IDE adapter when Kotlin bridge becomes available
      onBridgeReady();

      if (window.workingDirectory && !workingDirectory) {
        setWorkingDirectoryState(window.workingDirectory);
        api.setWorkingDir(window.workingDirectory);
      }
    };

    window.addEventListener('kotlinBridgeReady', handleBridgeReady);

    // 이미 kotlinBridge가 있고 workingDirectory가 주입된 경우
    if (window.kotlinBridge && window.workingDirectory && !workingDirectory) {
      setWorkingDirectoryState(window.workingDirectory);
      api.setWorkingDir(window.workingDirectory);
    }

    return () => window.removeEventListener('kotlinBridgeReady', handleBridgeReady);
  }, [api, workingDirectory]);

  const generateSessionId = useCallback(() => {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
        sessions.sort((a, b) => {
          const aTime = a.updatedAt?.getTime() ?? 0;
          const bTime = b.updatedAt?.getTime() ?? 0;
          return bTime - aTime;
        });
        return sessions;
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
  React.useEffect(() => {
    const unsubscribe = subscribe('STATE_CHANGE', (message) => {
      const state = message.payload?.state as SessionState;
      if (state) {
        setSessionState(state);
      }
    });
    return unsubscribe;
  }, [subscribe]);

  // Auto-save disabled - CLI sessions are read-only
  const scheduleAutoSave = useCallback(() => {
    // No-op: Local session saving removed, CLI sessions are managed externally
  }, []);

  const resetToNewSession = useCallback(() => {
    setCurrentSessionId(null);
    setSessionState('idle');
    messagesRef.current = [];

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

  const createSessionWithMessage = useCallback((firstMessage: string) => {
    const newId = generateSessionId();
    const now = new Date();
    const title = firstMessage.substring(0, 50).trim() || 'New Chat';

    const newSession: SessionMetaDto = {
      id: newId,
      title,
      createdAt: now,
      updatedAt: now,
      messageCount: 1,
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);

    api.sessions.activate(newId).catch(error => {
      console.error('[SessionContext] Failed to change session:', error);
    });

    // Local session saving removed - CLI sessions are managed externally

    onSessionChange?.(newId);
    return { sessionId: newId, title };
  }, [generateSessionId, onSessionChange, api.sessions]);

  const switchSession = useCallback(async (sessionId: string) => {
    console.log('[SessionContext] switchSession called with:', sessionId);

    if (sessions.some(s => s.id === sessionId)) {
      setCurrentSessionId(sessionId);
      setSessionState('idle');
      messagesRef.current = [];

      try {
        // Triggers SESSION_LOADED event → AppProviders.SessionLoader handles message injection
        await api.sessions.load(sessionId);
        console.log('[SessionContext] Session load requested:', sessionId);
      } catch (error) {
        console.error('[SessionContext] Failed to load session:', error);
      }

      onSessionChange?.(sessionId);
    } else {
      console.warn('[SessionContext] Session not found in list:', sessionId);
    }
  }, [sessions, onSessionChange, api.sessions]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await api.sessions.destroy(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setSessionState('idle');
        messagesRef.current = [];
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

  const saveMessages = useCallback((messages: LoadedMessageDto[]) => {
    if (!currentSessionId) return;

    messagesRef.current = messages;

    setSessions(prev => prev.map(s =>
      s.id === currentSessionId
        ? { ...s, messageCount: messages.length, updatedAt: new Date() }
        : s
    ));

    scheduleAutoSave();
  }, [currentSessionId, scheduleAutoSave]);

  // Cleanup
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
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
    loadSessions,
    resetToNewSession,
    openNewTab,
    openSettings,
    createSessionWithMessage,
    switchSession,
    deleteSession,
    renameSession,
    setSessionState,
    saveMessages,
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
