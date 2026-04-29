import { createContext, useContext, ReactNode, useEffect, useCallback, useState, useRef } from 'react';
import { useChatStream } from '../hooks/useChatStream';
import { useDiffs } from '../hooks/useDiffs';
import { useTools } from '../hooks/useTools';
import { useBridgeContext } from './BridgeContext';
import { useSessionContext } from './SessionContext';
import { LoadedMessageDto, Context, Attachment, SessionState } from '../types';
import { toModelAlias } from '@/types/models';
import { InputMode, InputModeValues } from '../types/chatInput';

/** 스트리밍 중 큐잉된 메시지의 bridge payload */
interface QueuedMessage {
  [key: string]: unknown;
  sessionId: string;
  isNewSession: boolean;
  content: string;
  attachments?: Array<Record<string, unknown>>;
  context: Context[];
  workingDir: string;
  inputMode: InputMode;
}

interface ChatStreamContextType {
  // From useChatStream
  messages: LoadedMessageDto[];
  isStreaming: boolean;
  streamingMessageId: string | null;
  error: Error | null;
  authDiagnosis: { envApiKeys: string[]; message: string } | null;

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
  sessionModel: string | null;
  setSessionModel: (model: string | null) => void;
  resetForSessionSwitch: () => void;

  // Context window usage
  contextWindowUsage: { totalTokens: number; contextWindow: number; maxOutputTokens: number } | null;
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
  const [sessionModel, setSessionModel] = useState<string | null>(null);

  // Save input draft to localStorage for tab move/split restoration.
  // Skip the first mount to prevent the initial empty input from clearing
  // a saved draft (JCEF may reload the page on browser component reattach).
  const draftInitializedRef = useRef(false);
  useEffect(() => {
    if (!session.currentSessionId) return;
    if (!draftInitializedRef.current) {
      draftInitializedRef.current = true;
      return;
    }
    const key = `claude-gui:draft:${session.currentSessionId}`;
    if (input) {
      localStorage.setItem(key, input);
    } else {
      localStorage.removeItem(key);
    }
  }, [input, session.currentSessionId]);

  // EnterPlanMode 진입 전의 모드를 저장 (ExitPlanMode 시 복원용)
  const prePlanModeRef = useRef<InputMode | null>(null);

  // 스트리밍 중 새 메시지가 들어오면 여기에 큐잉.
  // 현재 턴이 자연스럽게 완료(result)된 후 자동으로 flush된다.
  const queuedMessageRef = useRef<QueuedMessage | null>(null);

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
    onToolUseStart: (toolName: string) => {
      if (toolName === 'EnterPlanMode') {
        // 현재 모드가 이미 plan이 아닌 경우에만 저장
        if (session.inputMode !== InputModeValues.PLAN) {
          prePlanModeRef.current = session.inputMode;
        }
        session.setInputMode(InputModeValues.PLAN);
      }
      // ExitPlanMode는 여기서 처리하지 않음.
      // 사용자가 AcceptPlanPanel에서 승인/거부를 선택하는 시점에 ChatPanel에서 모드를 변경한다.
    },
  });

  // systemInit 변경 시 sessionModel 동기화
  useEffect(() => {
    if (chatStream.systemInit) {
      const rawModel = (chatStream.systemInit as Record<string, unknown>).model as string | null ?? null;
      setSessionModel(rawModel ? toModelAlias(rawModel) : null);
    }
  }, [chatStream.systemInit]);

  // 모든 세션별 상태를 한 번에 리셋하는 통합 함수
  const resetForSessionSwitch = useCallback(() => {
    chatStream.clearMessages();
    chatStream.resetStreamState();
    // Restore draft input from cache (tab move/split restoration)
    const draft = session.currentSessionId
      ? localStorage.getItem(`claude-gui:draft:${session.currentSessionId}`)
      : null;
    setInput(draft || '');
    setIsThinkingExpanded(false);
    setSessionModel(null);
    tools.clearToolUses();
    diffs.clearDiffs();
    queuedMessageRef.current = null;
    prePlanModeRef.current = null;
  }, [chatStream.clearMessages, chatStream.resetStreamState, tools.clearToolUses, diffs.clearDiffs, session.currentSessionId]);

  // resetForSessionSwitch is called directly by SessionLoader
  // when currentSessionId changes (URL-driven reactive pattern)

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

  // sendMessage: add to local state + send to backend (or queue if streaming)
  const sendMessage = useCallback(
    (content: string, inputMode: InputMode, context?: Context[], attachments?: Attachment[]) => {
      // Resolve session ID: use existing or generate new one
      let sessionId = session.currentSessionId;
      const isNewSession = !sessionId;
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        session.addNewSession(sessionId, content);
        console.log('[ChatStreamContext] New session created:', sessionId);
      }

      // Add to local chat state (항상 — UI에는 즉시 표시)
      chatStream.addUserMessage(content, context, attachments);

      const payload: QueuedMessage = {
        sessionId,
        isNewSession,
        content,
        attachments: attachments?.map(a => ({ ...a.toPayload() })),
        context: context || [],
        workingDir: session.workingDirectory ?? '',
        inputMode,
      };

      // 스트리밍 중이면 큐잉. stdin에 즉시 write하지 않는다.
      // 현재 턴이 자연스럽게 완료(result)된 후 useEffect에서 자동 flush.
      if (chatStream.isStreaming) {
        console.log('[ChatStreamContext] Queuing message — waiting for current turn to complete');
        queuedMessageRef.current = payload;
        return;
      }

      // 스트리밍 중이 아니면 즉시 전송
      bridge.send('SEND_MESSAGE', payload).then((response) => {
        if (response?.status === 'error') {
          console.error('[ChatStreamContext] Backend error:', response.error);
        }
      }).catch((error) => {
        console.error('[ChatStreamContext] Failed to send message to bridge:', error);
      });
    },
    [chatStream, bridge, session]
  );

  // 스트리밍 종료(result 수신) 시 큐잉된 메시지 자동 전송.
  // useEffect를 사용하여 endStreaming()의 상태 리셋이 완료된 후 flush한다.
  useEffect(() => {
    if (!chatStream.isStreaming && queuedMessageRef.current) {
      const queued = queuedMessageRef.current;
      queuedMessageRef.current = null;
      console.log('[ChatStreamContext] Flushing queued message after turn complete');
      bridge.send('SEND_MESSAGE', queued).then((response) => {
        if (response?.status === 'error') {
          console.error('[ChatStreamContext] Queued message error:', response.error);
        }
      }).catch((error) => {
        console.error('[ChatStreamContext] Failed to send queued message:', error);
      });
    }
  }, [chatStream.isStreaming, bridge]);

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

  // stop: stdin interrupt를 백엔드에 전송.
  // CLI가 현재 턴을 중단하고, 큐잉된 메시지가 있으면 그것을 이어서 처리한다.
  // 로컬 상태(streaming, sessionState)는 CLI의 스트림 이벤트에 의해 자연스럽게 갱신된다.
  const stop = useCallback(() => {
    console.log('[ChatStreamContext] Sending interrupt to backend');

    // Send interrupt signal to backend (stdin control_request)
    bridge.send('STOP_SESSION', {}).catch((error) => {
      console.error('[ChatStreamContext] Failed to send interrupt:', error);
    });
  }, [bridge]);

  // continue: send auto-continue message via --resume
  const continueGeneration = useCallback(() => {
    console.log('[ChatStreamContext] Continuing generation via sendMessage');

    // Auto-send continue message — triggers ensureClaudeProcess(--resume) in backend
    sendMessage('Please continue from where you left off.', sessionRef.current.inputMode);
  }, [sendMessage]);

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
    streamingMessageId: chatStream.streamingMessageId,
    error: chatStream.error,
    authDiagnosis: chatStream.authDiagnosis,

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
    sessionModel,
    setSessionModel,
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
