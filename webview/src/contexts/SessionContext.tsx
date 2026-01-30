import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { SessionMeta, SessionState, Message } from '../types';
import { useBridgeContext } from './BridgeContext';

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
  const { send, subscribe, isConnected } = useBridgeContext();

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [workingDirectory, setWorkingDirectory] = useState<string>(
    window.workingDirectory || '/Users/yonghyun/Projects/yhk1038/claude-code-gui-jetbrains'
  );

  const messagesRef = useRef<Message[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessagesLoadedRef = useRef(onMessagesLoaded);
  onMessagesLoadedRef.current = onMessagesLoaded;

  const generateSessionId = useCallback(() => {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // loadSessions - 명시적으로 호출해야 함
  const loadSessions = useCallback(async () => {
    if (!isConnected) {
      console.log('[SessionContext] Not connected, cannot load sessions');
      return;
    }

    try {
      setIsLoading(true);
      console.log('[SessionContext] Loading sessions from:', workingDirectory);
      const response = await send('GET_SESSIONS', { workingDir: workingDirectory });

      if (response?.sessions && Array.isArray(response.sessions)) {
        const loadedSessions = response.sessions.map((s: any) => ({
          id: s.sessionId,
          title: s.firstPrompt?.substring(0, 50) || 'No title',
          createdAt: s.created,
          updatedAt: s.modified,
          messageCount: s.messageCount || 0,
        }));
        setSessions(loadedSessions);
        console.log('[SessionContext] Loaded CLI sessions:', loadedSessions);
      }
    } catch (error) {
      console.error('[SessionContext] Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, send, workingDirectory]);

  // Subscribe to session loaded response
  React.useEffect(() => {
    return subscribe('SESSION_LOADED', (message) => {
      if (message.payload?.messages) {
        const messages = message.payload?.messages as any[];
        console.log('[SessionContext] Session loaded with messages:', messages?.length || 0);
        onMessagesLoadedRef.current?.(message.payload.messages as any);
      }
    });
  }, [subscribe]);

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

  const scheduleAutoSave = useCallback(() => {
    if (!currentSessionId) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const currentSession = sessions.find(s => s.id === currentSessionId);
      if (!currentSession) return;

      send('SAVE_SESSION', {
        sessionId: currentSessionId,
        title: currentSession.title,
        createdAt: currentSession.createdAt,
        updatedAt: new Date().toISOString(),
        messages: messagesRef.current,
      }).catch(error => {
        console.error('[SessionContext] Auto-save failed:', error);
      });
    }, 2000);
  }, [currentSessionId, sessions, send]);

  const resetToNewSession = useCallback(() => {
    setCurrentSessionId(null);
    setSessionState('idle');
    messagesRef.current = [];

    send('NEW_SESSION', {}).catch(error => {
      console.error('[SessionContext] Failed to clear CLI session:', error);
    });
  }, [send]);

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

    send('SESSION_CHANGE', { sessionId: newId }).catch(error => {
      console.error('[SessionContext] Failed to change session:', error);
    });

    send('SAVE_SESSION', {
      sessionId: newId,
      title,
      createdAt: now,
      updatedAt: now,
      messages: [],
    }).catch(error => {
      console.error('[SessionContext] Failed to save new session:', error);
    });

    onSessionChange?.(newId);
    return { sessionId: newId, title };
  }, [generateSessionId, onSessionChange, send]);

  const switchSession = useCallback(async (sessionId: string) => {
    console.log('[SessionContext] switchSession called with:', sessionId);

    if (sessions.some(s => s.id === sessionId)) {
      setCurrentSessionId(sessionId);
      setSessionState('idle');
      messagesRef.current = [];

      try {
        await send('LOAD_SESSION', { sessionId, workingDir: workingDirectory });
        console.log('[SessionContext] LOAD_SESSION sent successfully');
      } catch (error) {
        console.error('[SessionContext] Failed to load session:', error);
      }

      onSessionChange?.(sessionId);
    } else {
      console.warn('[SessionContext] Session not found in list:', sessionId);
    }
  }, [sessions, onSessionChange, send, workingDirectory]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await send('DELETE_SESSION', { sessionId });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setSessionState('idle');
        messagesRef.current = [];
      }
    } catch (error) {
      console.error('[SessionContext] Failed to delete session:', error);
    }
  }, [currentSessionId, send]);

  const renameSession = useCallback((sessionId: string, title: string) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? { ...s, title, updatedAt: new Date().toISOString() }
        : s
    ));

    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      send('SAVE_SESSION', {
        sessionId,
        title,
        createdAt: session.createdAt,
        updatedAt: new Date().toISOString(),
        messages: messagesRef.current,
      }).catch(error => {
        console.error('[SessionContext] Failed to save renamed session:', error);
      });
    }
  }, [sessions, send]);

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
