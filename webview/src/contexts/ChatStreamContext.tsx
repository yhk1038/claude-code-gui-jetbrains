import { createContext, useContext, ReactNode, useEffect, useCallback, useState, useRef } from 'react';
import { useChatStream } from '../hooks/useChatStream';
import { useDiffs } from '../hooks/useDiffs';
import { useTools } from '../hooks/useTools';
import { useBridgeContext } from './BridgeContext';
import { useSessionContext } from './SessionContext';
import { LoadedMessageDto, Context, Attachment, AttachmentPayload, SessionState } from '../types';
import { MessageRole, LoadedMessageType } from '../dto/common';
import { InputMode } from '../types/chatInput';

interface ChatStreamContextType {
  // From useChatStream
  messages: LoadedMessageDto[];
  isStreaming: boolean;
  isStopped: boolean;
  streamingMessageId: string | null;
  error: Error | null;

  // Local input state
  input: string;
  setInput: (input: string) => void;

  // Actions
  sendMessage: (content: string, inputMode: InputMode, context?: Context[], attachments?: Attachment[]) => void;
  handleSubmit: (e: React.FormEvent | undefined, inputMode: InputMode, attachments?: Attachment[]) => void;
  stop: () => void;
  continue: () => void;
  retry: (messageId: string) => void;

  resetStreamState: () => void;
  // From useChatStream (message manipulation)
  clearMessages: () => void;
  loadMessages: (msgs: LoadedMessageDto[]) => void;
  appendMessage: (message: LoadedMessageDto) => void;
  updateMessage: (id: string, updates: Partial<LoadedMessageDto>) => void;

  // Subsystems (preserved)
  tools: ReturnType<typeof useTools>;
  diffs: ReturnType<typeof useDiffs>;

  // Thinking block global expand/collapse state
  isThinkingExpanded: boolean;
  toggleThinkingExpanded: () => void;

  // Session lifecycle
  systemInit: Record<string, unknown> | null;
  resetForSessionSwitch: () => void;

  // Context window usage
  contextWindowUsage: { inputTokens: number; outputTokens: number; model: string | null } | null;
}

const ChatStreamContext = createContext<ChatStreamContextType | undefined>(undefined);

export function useChatStreamContext() {
  const context = useContext(ChatStreamContext);
  if (!context) {
    throw new Error('useChatStreamContext must be used within a ChatStreamProvider');
  }
  return context;
}

interface ChatStreamProviderProps {
  children: ReactNode;
}

export function ChatStreamProvider({ children }: ChatStreamProviderProps) {
  const bridge = useBridgeContext();
  const session = useSessionContext();
  const tools = useTools();
  const diffs = useDiffs();

  const [input, setInput] = useState('');
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const toggleThinkingExpanded = useCallback(() => setIsThinkingExpanded(prev => !prev), []);

  // Initialize useChatStream with bridge and callbacks
  const chatStream = useChatStream({
    bridge: {
      isConnected: bridge.isConnected,
      send: bridge.send,
      subscribe: bridge.subscribe,
    },
    onStreamStart: (messageId: string) => {
      console.log('[ChatStreamContext] Stream started:', messageId);
      session.setSessionState(SessionState.Streaming);
    },
    onStreamEnd: (messageId: string) => {
      console.log('[ChatStreamContext] Stream ended:', messageId);
      session.setSessionState(SessionState.Idle);
    },
    onError: (error: Error) => {
      console.error('[ChatStreamContext] Stream error:', error);
      session.setSessionState(SessionState.Error);
    },
    onSystemMessage: (data: Record<string, unknown>) => {
      console.log('[ChatStreamContext] System message:', data);
    },
  });

  // 모든 세션별 상태를 한 번에 리셋하는 통합 함수
  const resetForSessionSwitch = useCallback(() => {
    chatStream.clearMessages();
    chatStream.resetStreamState();
    setInput('');
    setIsThinkingExpanded(false);
    tools.clearToolUses();
    diffs.clearDiffs();
  }, [chatStream.clearMessages, chatStream.resetStreamState, tools.clearToolUses, diffs.clearDiffs]);

  // 세션 전환 자동 감지: currentSessionId 변경 시 모든 세션별 상태 리셋
  const prevSessionIdRef = useRef<string | null>(session.currentSessionId);
  useEffect(() => {
    const prevId = prevSessionIdRef.current;
    prevSessionIdRef.current = session.currentSessionId;
    if (prevId !== null && prevId !== session.currentSessionId) {
      console.log('[ChatStreamContext] Session switch detected:', prevId, '→', session.currentSessionId);
      resetForSessionSwitch();
    }
  }, [session.currentSessionId, resetForSessionSwitch]);

  // ref로 안정화 (useEffect 의존성 churn 방지)
  const toolsRef = useRef(tools);
  const diffsRef = useRef(diffs);
  const sessionRef = useRef(session);
  toolsRef.current = tools;
  diffsRef.current = diffs;
  sessionRef.current = session;

  // Subscribe to bridge events for tools and diffs
  useEffect(() => {
    if (!bridge.isConnected) return;

    const unsubscribeToolUse = bridge.subscribe('TOOL_USE', (message: IPCMessage) => {
      console.log('[ChatStreamContext] TOOL_USE received:', message.payload);
      toolsRef.current.addToolUse(message.payload as any);
      sessionRef.current.setSessionState(SessionState.WaitingPermission);
    });

    const unsubscribeDiff = bridge.subscribe('DIFF_PROPOSED', (message: IPCMessage) => {
      console.log('[ChatStreamContext] DIFF_PROPOSED received:', message.payload);
      diffsRef.current.addDiff(message.payload as any);
      sessionRef.current.setSessionState(SessionState.HasDiff);
    });

    return () => {
      unsubscribeToolUse();
      unsubscribeDiff();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.isConnected, bridge.subscribe]);

  // sendMessage: add to local state + send to Kotlin + create session if needed
  const sendMessage = useCallback(
    (content: string, inputMode: InputMode, context?: Context[], attachments?: Attachment[]) => {
      // Resolve session ID: use existing or generate new one
      let sessionId = session.currentSessionId;
      const isNewSession = !sessionId;
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        session.setCurrentSessionId(sessionId);
        session.addNewSession(sessionId, content);
        console.log('[ChatStreamContext] New session created:', sessionId);
      }

      // Add to local chat state
      chatStream.addUserMessage(content, context, attachments);

      // Send to bridge with sessionId
      bridge.send('SEND_MESSAGE', {
        sessionId,
        isNewSession,
        content,
        attachments: attachments?.map((a): AttachmentPayload => ({
          fileName: a.fileName,
          mimeType: a.mimeType,
          base64: a.base64,
        })),
        context: context || [],
        workingDir: session.workingDirectory,
        inputMode,
      }).then((response) => {
        if (response?.status === 'error') {
          console.error('[ChatStreamContext] Kotlin error:', response.error);
        }
      }).catch((error) => {
        console.error('[ChatStreamContext] Failed to send message to bridge:', error);
      });
    },
    [chatStream, bridge, session]
  );

  // handleSubmit: convenience wrapper for form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent | undefined, inputMode: InputMode, attachments?: Attachment[]) => {
      if (e) e.preventDefault();
      const trimmedInput = input.trim();
      if (!trimmedInput && (!attachments || attachments.length === 0)) return;
      sendMessage(trimmedInput, inputMode, undefined, attachments);
      setInput('');
    },
    [input, sendMessage]
  );

  // stop: stop streaming locally + send STOP_SESSION to Kotlin + set idle state
  const stop = useCallback(() => {
    console.log('[ChatStreamContext] Stopping session');

    // Determine interrupt type based on current session state
    const interruptText = session.sessionState === SessionState.WaitingPermission
      ? '[Request interrupted by user for tool use]'
      : '[Request interrupted by user]';

    // Add interrupted message immediately to chat
    chatStream.appendMessage({
      type: LoadedMessageType.User,
      uuid: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      message: { role: MessageRole.User, content: interruptText } as LoadedMessageDto['message'],
    });

    // Stop local streaming
    chatStream.stop();

    // Send stop signal to backend
    bridge.send('STOP_SESSION', {}).catch((error) => {
      console.error('[ChatStreamContext] Failed to stop session:', error);
    });

    // Set session state to idle
    session.setSessionState(SessionState.Idle);
  }, [chatStream, bridge, session]);

  // continue: reset isStopped + send auto-continue message via --resume
  const continueGeneration = useCallback(() => {
    console.log('[ChatStreamContext] Continuing generation via sendMessage');

    // Reset isStopped state
    chatStream.continue();

    // Auto-send continue message — triggers ensureClaudeProcess(--resume) in backend
    sendMessage('Please continue from where you left off.', 'ask_before_edit');
  }, [chatStream, sendMessage]);

  // retry: delegate to chatStream
  const retry = useCallback(
    (messageId: string) => {
      console.log('[ChatStreamContext] Retrying message:', messageId);
      chatStream.retry(messageId);
    },
    [chatStream]
  );

  const contextValue: ChatStreamContextType = {
    // From useChatStream
    messages: chatStream.messages,
    isStreaming: chatStream.isStreaming,
    isStopped: chatStream.isStopped,
    streamingMessageId: chatStream.streamingMessageId,
    error: chatStream.error,

    // Local input state
    input,
    setInput,

    // Actions
    sendMessage,
    handleSubmit,
    stop,
    continue: continueGeneration,
    retry,

    resetStreamState: chatStream.resetStreamState,

    // Message manipulation
    clearMessages: chatStream.clearMessages,
    loadMessages: chatStream.loadMessages,
    appendMessage: chatStream.appendMessage,
    updateMessage: chatStream.updateMessage,

    // Subsystems
    tools,
    diffs,

    // Thinking block global expand/collapse state
    isThinkingExpanded,
    toggleThinkingExpanded,

    // Session lifecycle
    systemInit: chatStream.systemInit,
    resetForSessionSwitch,

    // Context window usage
    contextWindowUsage: chatStream.contextWindowUsage,
  };

  return (
    <ChatStreamContext.Provider value={contextValue}>
      {children}
    </ChatStreamContext.Provider>
  );
}
