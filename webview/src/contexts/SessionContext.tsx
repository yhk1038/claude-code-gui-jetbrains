import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { SessionMeta, SessionState, Message } from '../types';
import { useBridgeContext } from './BridgeContext';
import { useApi } from './ApiContext';

declare global {
  interface Window {
    workingDirectory?: string;
  }
}

interface SessionContextValue {
  // State
  currentSessionId: string | null;
  sessions: SessionMeta[];
  sessionState: SessionState;
  isLoading: boolean;
  workingDirectory: string;

  // Actions
  loadSessions: () => Promise<void>;
  resetToNewSession: () => void;
  createSessionWithMessage: (firstMessage: string) => { sessionId: string; title: string };
  switchSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => void;
  setSessionState: (state: SessionState) => void;
  saveMessages: (messages: Message[]) => void;
  setWorkingDirectory: (dir: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: ReactNode;
  onSessionChange?: (sessionId: string) => void;
  onMessagesLoaded?: (messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>) => void;
}

export function SessionProvider({ children, onSessionChange, onMessagesLoaded }: SessionProviderProps) {
  const { subscribe, isConnected } = useBridgeContext();
  const api = useApi();

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [workingDirectory, setWorkingDirectoryState] = useState<string>(
    window.workingDirectory || '/Users/yonghyun/Projects/yhk1038/claude-code-gui-jetbrains'
  );

  const messagesRef = useRef<Message[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessagesLoadedRef = useRef(onMessagesLoaded);
  onMessagesLoadedRef.current = onMessagesLoaded;

  // Update API workingDir when it changes
  const setWorkingDirectory = useCallback((dir: string) => {
    setWorkingDirectoryState(dir);
    api.setWorkingDir(dir);
  }, [api]);

  // Initialize API workingDir on mount
  React.useEffect(() => {
    api.setWorkingDir(workingDirectory);
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

    try {
      setIsLoading(true);
      console.log('[SessionContext] Loading sessions from:', workingDirectory);

      const sessionDtos = await api.sessions.index();

      const loadedSessions: SessionMeta[] = sessionDtos.map((dto) => ({
        id: dto.id,
        title: dto.title,
        createdAt: dto.createdAt,
        updatedAt: dto.updatedAt,
        messageCount: dto.messageCount,
      }));

      setSessions(loadedSessions);
      console.log('[SessionContext] Loaded CLI sessions:', loadedSessions);
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

  const createSessionWithMessage = useCallback((firstMessage: string) => {
    const newId = generateSessionId();
    const now = new Date().toISOString();
    const title = firstMessage.substring(0, 50).trim() || 'New Chat';

    const newSession: SessionMeta = {
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
        const { messages } = await api.sessions.show(sessionId);
        console.log('[SessionContext] Session loaded with messages:', messages.length);
        onMessagesLoadedRef.current?.(messages as any);
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
        ? { ...s, title, updatedAt: new Date().toISOString() }
        : s
    ));
    // Note: CLI session titles cannot be modified from the plugin
  }, []);

  const saveMessages = useCallback((messages: Message[]) => {
    if (!currentSessionId) return;

    messagesRef.current = messages;

    setSessions(prev => prev.map(s =>
      s.id === currentSessionId
        ? { ...s, messageCount: messages.length, updatedAt: new Date().toISOString() }
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

  const value: SessionContextValue = {
    currentSessionId,
    sessions,
    sessionState,
    isLoading,
    workingDirectory,
    loadSessions,
    resetToNewSession,
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
