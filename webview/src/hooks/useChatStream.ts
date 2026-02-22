import { useCallback, useState, useRef, useEffect } from 'react';
import { Context, getTextContent, LoadedMessageDto } from '../types';
import { toInstance } from '../dto/common';

/** Re-export for backwards compatibility */
export type { LoadedMessageDto as LoadedMessage } from '../types';

export interface UseChatStreamOptions {
  /** BridgeContext에서 가져온 bridge. subscribe/send/isConnected 포함. */
  bridge: {
    isConnected: boolean;
    send: (type: string, payload: Record<string, unknown>) => Promise<any>;
    subscribe: (type: string, handler: (message: IPCMessage) => void) => () => void;
  };
  /** 스트림 시작 시 콜백 (SessionContext 상태 변경용) */
  onStreamStart?: (messageId: string) => void;
  /** 스트림 종료 시 콜백 */
  onStreamEnd?: (messageId: string) => void;
  /** 에러 발생 시 콜백 */
  onError?: (error: Error) => void;
  /** 시스템 메시지 수신 시 콜백 */
  onSystemMessage?: (data: { sessionId: string; content: unknown }) => void;
}

export interface UseChatStreamReturn {
  messages: LoadedMessageDto[];
  isStreaming: boolean;
  isStopped: boolean;
  streamingMessageId: string | null;
  error: Error | null;

  // 로컬 메시지 조작 (전송은 하지 않음)
  addUserMessage: (content: string, context?: Context[]) => void;
  clearMessages: () => void;
  loadMessages: (msgs: LoadedMessageDto[]) => void;
  appendMessage: (message: LoadedMessageDto) => void;
  updateMessage: (id: string, updates: Partial<LoadedMessageDto>) => void;

  // 재시도
  retry: (messageId: string) => void;

  // 스트리밍 제어
  /** isStopped = true, isStreaming = false 설정. bridge 전송은 ChatStreamContext가 담당. */
  stop: () => void;
  /** isStopped = false 설정. bridge 전송은 ChatStreamContext가 담당. */
  continue: () => void;
}

export function useChatStream(options: UseChatStreamOptions): UseChatStreamReturn {
  const { bridge, onStreamStart, onStreamEnd, onError, onSystemMessage } = options;

  const [messages, setMessages] = useState<LoadedMessageDto[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // RAF 스로틀링 관련 refs
  const pendingDeltaRef = useRef<string>('');
  const rafIdRef = useRef<number | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null); // setState 비동기 대응
  const devModeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const devModeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 콜백을 ref로 안정화 (useEffect 의존성 churn 방지)
  const onStreamStartRef = useRef(onStreamStart);
  const onStreamEndRef = useRef(onStreamEnd);
  const onErrorRef = useRef(onError);
  const onSystemMessageRef = useRef(onSystemMessage);
  onStreamStartRef.current = onStreamStart;
  onStreamEndRef.current = onStreamEnd;
  onErrorRef.current = onError;
  onSystemMessageRef.current = onSystemMessage;

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Append a new message
  const appendMessage = useCallback((message: LoadedMessageDto) => {
    setMessages(prev => [...prev, message]);
  }, []);

  // Update an existing message
  const updateMessage = useCallback((id: string, updates: Partial<LoadedMessageDto>) => {
    setMessages(prev => prev.map(msg =>
      msg.uuid === id ? { ...msg, ...updates } : msg
    ));
  }, []);

  // RAF flush - batch update for delta accumulation
  const flushPendingDelta = useCallback(() => {
    rafIdRef.current = null;
    if (pendingDeltaRef.current && streamingMessageIdRef.current) {
      const delta = pendingDeltaRef.current;
      const msgId = streamingMessageIdRef.current;
      pendingDeltaRef.current = '';

      setMessages(prev => prev.map(msg => {
        if (msg.uuid === msgId) {
          const currentContent = typeof msg.message?.content === 'string' ? msg.message.content : '';
          return { ...msg, message: { ...msg.message!, content: currentContent + delta } };
        }
        return msg;
      }));
    }
  }, []);

  // Schedule RAF flush
  const scheduleFlush = useCallback(() => {
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(flushPendingDelta);
    }
  }, [flushPendingDelta]);

  // Start streaming helper
  const startStreaming = useCallback((messageId: string) => {
    setIsStreaming(true);
    setStreamingMessageId(messageId);
    streamingMessageIdRef.current = messageId;
    pendingDeltaRef.current = '';
    onStreamStartRef.current?.(messageId);
  }, []);

  // End streaming helper
  const endStreaming = useCallback(() => {
    // Flush any remaining delta
    if (pendingDeltaRef.current && streamingMessageIdRef.current) {
      flushPendingDelta();
    }
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const msgId = streamingMessageIdRef.current;
    if (msgId) {
      updateMessage(msgId, { isStreaming: false });
      onStreamEndRef.current?.(msgId);
    }

    setIsStreaming(false);
    setStreamingMessageId(null);
    streamingMessageIdRef.current = null;
  }, [flushPendingDelta, updateMessage]);

  // addUserMessage - 로컬 상태 조작만 (bridge.send 하지 않음)
  const addUserMessage = useCallback((content: string, context?: Context[]) => {
    if (!content.trim() || isStreaming) return;

    setError(null);

    // Create user message in JSONL structure
    const userMessage: LoadedMessageDto = {
      type: 'user',
      uuid: generateMessageId(),
      timestamp: new Date().toISOString(),
      message: { role: 'user', content: content.trim() } as any,
      context,
    };
    appendMessage(userMessage);

    // Create assistant placeholder
    const assistantMessageId = generateMessageId();
    const assistantMessage: LoadedMessageDto = {
      type: 'assistant',
      uuid: assistantMessageId,
      timestamp: new Date().toISOString(),
      message: { role: 'assistant', content: '' } as any,
      isStreaming: true,
    };
    appendMessage(assistantMessage);
    startStreaming(assistantMessageId);

    // Dev mode fallback
    if (!bridge.isConnected) {
      console.log('[useChatStream] Dev mode: simulating mock response');
      const mockResponse = 'This is a mock response from dev mode. Bridge not connected.';

      devModeTimeoutRef.current = setTimeout(() => {
        let charIndex = 0;
        devModeIntervalRef.current = setInterval(() => {
          if (charIndex < mockResponse.length) {
            pendingDeltaRef.current += mockResponse[charIndex];
            scheduleFlush();
            charIndex++;
          } else {
            if (devModeIntervalRef.current) {
              clearInterval(devModeIntervalRef.current);
              devModeIntervalRef.current = null;
            }
            endStreaming();
          }
        }, 30);
      }, 2000);
    }
  }, [isStreaming, bridge.isConnected, generateMessageId, appendMessage, startStreaming, scheduleFlush, endStreaming]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  // Load messages from raw JSONL entries.
  // LoadedMessageDto's @Type/@Transform decorators handle nested transformation automatically.
  const loadMessages = useCallback((msgs: LoadedMessageDto[]) => {
    const convertedMessages = msgs
      // .filter(raw => raw.type === 'user' || raw.type === 'assistant')
      .map(raw => toInstance(LoadedMessageDto, raw));

    setMessages(convertedMessages);
    setError(null);
    console.log('[useChatStream] Loaded messages:', convertedMessages.length);
  }, []);

  // Retry
  const retry = useCallback((messageId: string) => {
    const messageIndex = messages.findIndex(m => m.uuid === messageId);
    if (messageIndex === -1) return;

    // Find the last user message before this message
    let userMessage: LoadedMessageDto | null = null;
    for (let i = messageIndex; i >= 0; i--) {
      if (messages[i].type === 'user') {
        userMessage = messages[i];
        break;
      }
    }

    if (userMessage) {
      // Remove messages from the failed one onwards
      setMessages(prev => prev.slice(0, messageIndex));
      // Re-add user message and trigger send
      const content = getTextContent(userMessage);
      addUserMessage(content, userMessage.context);
      // Also send via bridge
      bridge.send('SEND_MESSAGE', {
        content,
        context: userMessage.context || [],
      }).catch((err) => {
        console.error('[useChatStream] Error retrying message:', err);
        setError(err);
        endStreaming();
      });
    }
  }, [messages, addUserMessage, bridge, endStreaming]);

  // Stop
  const stop = useCallback(() => {
    setIsStopped(true);
    setIsStreaming(false);
  }, []);

  // Continue
  const continueGeneration = useCallback(() => {
    setIsStopped(false);
  }, []);

  // Subscribe to Kotlin events
  useEffect(() => {
    // STREAM_EVENT handler
    const unsubscribeStreamEvent = bridge.subscribe('STREAM_EVENT', (message) => {
      const payload = message.payload;

      // 시스템 메시지 판별
      if (payload?.eventType === 'system') {
        onSystemMessageRef.current?.({
          sessionId: payload.sessionId as string,
          content: payload.content,
        });
        return; // delta 처리 스킵
      }

      // text_delta 처리
      const delta = payload?.delta as Record<string, unknown> | undefined;
      if (delta && delta.type === 'text_delta' && delta.text) {
        // 첫 delta 시 streamingMessageId가 없으면 placeholder 자동 생성
        if (!streamingMessageIdRef.current) {
          const assistantMessageId = generateMessageId();
          const assistantMessage: LoadedMessageDto = {
            type: 'assistant',
            uuid: assistantMessageId,
            timestamp: new Date().toISOString(),
            message: { role: 'assistant', content: '' } as any,
            isStreaming: true,
          };
          appendMessage(assistantMessage);
          startStreaming(assistantMessageId);
        }

        // RAF 기반 축적
        pendingDeltaRef.current += delta.text as string;
        scheduleFlush();
      }

      // thinking_delta 처리
      if (delta && delta.type === 'thinking_delta' && delta.thinking) {
        // thinking delta도 text_delta와 동일한 스트리밍 방식 사용
        // 첫 delta 시 streamingMessageId가 없으면 placeholder 자동 생성
        if (!streamingMessageIdRef.current) {
          const assistantMessageId = generateMessageId();
          const assistantMessage: LoadedMessageDto = {
            type: 'assistant',
            uuid: assistantMessageId,
            timestamp: new Date().toISOString(),
            message: { role: 'assistant', content: '' } as any,
            isStreaming: true,
          };
          appendMessage(assistantMessage);
          startStreaming(assistantMessageId);
        }

        // thinking delta는 별도로 축적하지 않고 로그만 남김
        // (완성된 thinking 블록은 ASSISTANT_MESSAGE에서 처리됨)
        console.log('[useChatStream] thinking_delta received');
      }

      // tool_use_delta 처리 (추후 확장)
      if (delta && delta.type === 'tool_use_delta') {
        // TODO: tool_use 정보 축적
        console.log('[useChatStream] tool_use_delta received:', delta);
      }
    });

    // ASSISTANT_MESSAGE handler
    const unsubscribeAssistantMessage = bridge.subscribe('ASSISTANT_MESSAGE', (message) => {
      const payload = message.payload;
      const messageId = payload?.messageId as string;
      const content = payload?.content as Array<any>;

      if (!content || !Array.isArray(content)) return;

      // 기존 assistant 메시지 업데이트 또는 새로 생성
      if (streamingMessageIdRef.current) {
        updateMessage(streamingMessageIdRef.current, {
          message: { role: 'assistant', content } as any,
          isStreaming: false,
          message_id: messageId,
        });
      } else {
        // 새 메시지 추가
        const assistantMessage: LoadedMessageDto = {
          type: 'assistant',
          uuid: generateMessageId(),
          timestamp: new Date().toISOString(),
          message: { role: 'assistant', content } as any,
          isStreaming: false,
          message_id: messageId,
        };
        appendMessage(assistantMessage);
      }
    });

    // RESULT_MESSAGE handler
    const unsubscribeResultMessage = bridge.subscribe('RESULT_MESSAGE', (message) => {
      const payload = message.payload;
      const errorData = payload?.error as { code?: string; message?: string; details?: string } | null;

      // Flush 잔여 buffer
      if (pendingDeltaRef.current && streamingMessageIdRef.current) {
        flushPendingDelta();
      }

      // 에러 처리
      if (errorData) {
        const err = new Error(errorData.message || 'Unknown error');
        setError(err);
        onErrorRef.current?.(err);
      }

      // 스트리밍 종료
      endStreaming();
    });

    // SERVICE_ERROR handler
    const unsubscribeServiceError = bridge.subscribe('SERVICE_ERROR', (message) => {
      const payload = message.payload;
      const errorType = payload?.type as string;
      const reason = payload?.reason as string;

      const err = new Error(`Service error: ${errorType} - ${reason}`);
      setError(err);
      onErrorRef.current?.(err);
      endStreaming();
    });

    // USER_MESSAGE_BROADCAST handler — 다른 탭에서 보낸 사용자 메시지 수신
    const unsubscribeUserBroadcast = bridge.subscribe('USER_MESSAGE_BROADCAST', (message: IPCMessage) => {
      const content = message.payload?.content as string;
      if (!content) return;

      const userMessage: LoadedMessageDto = {
        type: 'user',
        uuid: generateMessageId(),
        timestamp: new Date().toISOString(),
        message: { role: 'user', content } as any,
      };
      appendMessage(userMessage);
    });

    // Cleanup
    return () => {
      unsubscribeStreamEvent();
      unsubscribeAssistantMessage();
      unsubscribeResultMessage();
      unsubscribeServiceError();
      unsubscribeUserBroadcast();
    };
  // bridge.subscribe는 useBridge의 useCallback([], [])이므로 안정적.
  // 나머지 콜백들은 ref로 안정화했으므로 의존성에서 제외.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.subscribe]);

  // Cleanup dev mode timers on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (devModeTimeoutRef.current) {
        clearTimeout(devModeTimeoutRef.current);
      }
      if (devModeIntervalRef.current) {
        clearInterval(devModeIntervalRef.current);
      }
    };
  }, []);

  return {
    messages,
    isStreaming,
    isStopped,
    streamingMessageId,
    error,
    addUserMessage,
    clearMessages,
    loadMessages,
    appendMessage,
    updateMessage,
    retry,
    stop,
    continue: continueGeneration,
  };
}
