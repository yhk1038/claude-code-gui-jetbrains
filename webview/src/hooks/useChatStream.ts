import { useCallback, useState, useRef, useEffect } from 'react';
import { Context, getTextContent, LoadedMessageDto, Attachment } from '../types';
import type { TextBlockDto, ToolUseBlockDto, ThinkingBlockDto, ImageBlockDto, ImageSourceDto, AnyContentBlockDto } from '../dto/message/ContentBlockDto';
import { ContentBlockType } from '../dto/message/ContentBlockDto';
import { toInstance, LoadedMessageType, MessageRole } from '../dto/common';

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
  onSystemMessage?: (data: Record<string, unknown>) => void;
}

export interface UseChatStreamReturn {
  messages: LoadedMessageDto[];
  isStreaming: boolean;
  isStopped: boolean;
  streamingMessageId: string | null;
  error: Error | null;

  // 로컬 메시지 조작 (전송은 하지 않음)
  addUserMessage: (content: string, context?: Context[], attachments?: Attachment[]) => void;
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
  /** 스트림 관련 모든 내부 상태를 초기화 (clear conversation 등에서 사용) */
  resetStreamState: () => void;
  systemInit: Record<string, unknown> | null;
  contextWindowUsage: { inputTokens: number; outputTokens: number; model: string | null } | null;
}

/**
 * Filter messages to only include those in active conversation chains.
 * Finds all leaf messages and traces parentUuid backwards from each leaf.
 * This preserves all conversation chains (including pre-compact history)
 * while still filtering out abandoned side-branches.
 * Summary entries (compact markers) and progress entries are always kept.
 */
function filterActiveChain(messages: LoadedMessageDto[]): LoadedMessageDto[] {
  if (messages.length === 0) return messages;

  // Build uuid → message lookup
  const byUuid = new Map<string, LoadedMessageDto>();
  for (const msg of messages) {
    if (msg.uuid) byUuid.set(msg.uuid, msg);
  }

  // Find all child→parent references to identify leaf messages
  const hasChild = new Set<string>();
  for (const msg of messages) {
    if (msg.parentUuid && byUuid.has(msg.parentUuid)) {
      hasChild.add(msg.parentUuid);
    }
  }

  // Find leaf messages (no message references them as parent)
  // For each leaf, trace back to root — collecting all active UUIDs
  const activeUuids = new Set<string>();
  for (const msg of messages) {
    if (!msg.uuid) continue;
    if (hasChild.has(msg.uuid)) continue; // not a leaf

    // Trace from this leaf backwards
    let current: LoadedMessageDto | undefined = msg;
    while (current) {
      if (current.uuid) activeUuids.add(current.uuid);
      const parentUuid = current.parentUuid;
      if (parentUuid && byUuid.has(parentUuid)) {
        current = byUuid.get(parentUuid);
      } else {
        break;
      }
    }
  }

  // Filter: keep messages in any active chain
  // progress and summary entries are always kept
  return messages.filter(msg => {
    if (msg.type === LoadedMessageType.Progress) return true;
    if (msg.type === LoadedMessageType.Summary) return true;
    return msg.uuid ? activeUuids.has(msg.uuid) : false;
  });
}

export function useChatStream(options: UseChatStreamOptions): UseChatStreamReturn {
  const { bridge, onStreamStart, onStreamEnd, onError, onSystemMessage } = options;

  const [messages, setMessages] = useState<LoadedMessageDto[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [systemInit, setSystemInit] = useState<Record<string, unknown> | null>(null);
  const [contextWindowUsage, setContextWindowUsage] = useState<{
    inputTokens: number;
    outputTokens: number;
    model: string | null;
  } | null>(null);

  // RAF 스로틀링 관련 refs
  const pendingTextRef = useRef<string>('');
  const pendingThinkingRef = useRef<string>('');
  const pendingInputJsonRef = useRef<string>('');              // RAF 프레임 간 input_json_delta 축적용
  const accumulatedInputJsonRef = useRef<string>('');          // 현재 tool_use 블록의 전체 누적 input JSON 문자열
  const rafIdRef = useRef<number | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null); // setState 비동기 대응
  const activeBlockIndexRef = useRef<number>(-1);             // 현재 스트리밍 중인 content block의 stream index
  const activeTextBlockIndexRef = useRef<number>(-1);         // content 배열 내 현재 활성 text 블록 인덱스
  const activeThinkingBlockIndexRef = useRef<number>(-1);     // content 배열 내 현재 활성 thinking 블록 인덱스
  const activeToolUseBlockIndexRef = useRef<number>(-1);      // content 배열 내 현재 활성 tool_use 블록 인덱스
  const turnStartBlockCountRef = useRef<number>(0);           // 현재 턴 시작 시 content 배열의 길이 (병합 기준점)
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
  const flushPendingDeltas = useCallback(() => {
    rafIdRef.current = null;
    const msgId = streamingMessageIdRef.current;
    if (!msgId) return;

    const textDelta = pendingTextRef.current;
    const thinkingDelta = pendingThinkingRef.current;
    const inputJsonDelta = pendingInputJsonRef.current;
    if (!textDelta && !thinkingDelta && !inputJsonDelta) return;

    pendingTextRef.current = '';
    pendingThinkingRef.current = '';
    pendingInputJsonRef.current = '';

    setMessages(prev => prev.map(msg => {
      if (msg.uuid !== msgId) return msg;

      const currentBlocks: AnyContentBlockDto[] = Array.isArray(msg.message?.content)
        ? [...msg.message!.content]
        : [];

      // Append thinking delta to the active thinking block (index-based)
      if (thinkingDelta) {
        const idx = activeThinkingBlockIndexRef.current;
        if (idx >= 0 && idx < currentBlocks.length && currentBlocks[idx].type === ContentBlockType.Thinking) {
          const block = currentBlocks[idx] as ThinkingBlockDto;
          currentBlocks[idx] = { ...block, thinking: block.thinking + thinkingDelta };
        } else {
          // Fallback: no active thinking block yet, create one
          currentBlocks.push({ type: ContentBlockType.Thinking, thinking: thinkingDelta } as ThinkingBlockDto);
          activeThinkingBlockIndexRef.current = currentBlocks.length - 1;
        }
      }

      // Append text delta to the active text block (index-based)
      if (textDelta) {
        const idx = activeTextBlockIndexRef.current;
        if (idx >= 0 && idx < currentBlocks.length && currentBlocks[idx].type === ContentBlockType.Text) {
          const block = currentBlocks[idx] as TextBlockDto;
          currentBlocks[idx] = { ...block, text: block.text + textDelta };
        } else {
          // Fallback: no active text block yet, create one
          currentBlocks.push({ type: ContentBlockType.Text, text: textDelta } as TextBlockDto);
          activeTextBlockIndexRef.current = currentBlocks.length - 1;
        }
      }

      // Append input JSON delta to the active tool_use block
      if (inputJsonDelta) {
        const idx = activeToolUseBlockIndexRef.current;
        if (idx >= 0 && idx < currentBlocks.length && currentBlocks[idx].type === ContentBlockType.ToolUse) {
          const block = currentBlocks[idx] as ToolUseBlockDto;
          // accumulatedInputJsonRef holds the full JSON string across all RAF frames
          accumulatedInputJsonRef.current += inputJsonDelta;
          let parsedInput = block.input;
          try {
            parsedInput = JSON.parse(accumulatedInputJsonRef.current) as Record<string, unknown>;
          } catch {
            // Not yet valid JSON, keep accumulating
          }
          currentBlocks[idx] = { ...block, input: parsedInput };
        }
      }

      return { ...msg, message: { ...msg.message!, content: currentBlocks } };
    }));
  }, []);

  // Schedule RAF flush
  const scheduleFlush = useCallback(() => {
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(flushPendingDeltas);
    }
  }, [flushPendingDeltas]);

  // Start streaming helper - initializes all streaming refs
  const startStreaming = useCallback((messageId: string) => {
    setIsStreaming(true);
    setStreamingMessageId(messageId);
    streamingMessageIdRef.current = messageId;
    pendingTextRef.current = '';
    pendingThinkingRef.current = '';
    pendingInputJsonRef.current = '';
    accumulatedInputJsonRef.current = '';
    activeBlockIndexRef.current = -1;
    activeTextBlockIndexRef.current = -1;
    activeThinkingBlockIndexRef.current = -1;
    activeToolUseBlockIndexRef.current = -1;
    turnStartBlockCountRef.current = 0;
    onStreamStartRef.current?.(messageId);
  }, []);

  // Ensure a streaming placeholder assistant message exists.
  // Returns the current streamingMessageId (creating one if needed).
  const ensureStreamingPlaceholder = useCallback((): string => {
    if (streamingMessageIdRef.current) {
      return streamingMessageIdRef.current;
    }
    const assistantMessageId = generateMessageId();
    const assistantMessage: LoadedMessageDto = {
      type: LoadedMessageType.Assistant,
      uuid: assistantMessageId,
      timestamp: new Date().toISOString(),
      message: { role: MessageRole.Assistant, content: [] } as LoadedMessageDto['message'],
      isStreaming: true,
    };
    appendMessage(assistantMessage);
    startStreaming(assistantMessageId);
    return assistantMessageId;
  }, [generateMessageId, appendMessage, startStreaming]);

  // End streaming helper
  const endStreaming = useCallback(() => {
    // Flush any remaining delta (including input JSON)
    if ((pendingTextRef.current || pendingThinkingRef.current || pendingInputJsonRef.current) && streamingMessageIdRef.current) {
      flushPendingDeltas();
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
    activeBlockIndexRef.current = -1;
    activeTextBlockIndexRef.current = -1;
    activeThinkingBlockIndexRef.current = -1;
    activeToolUseBlockIndexRef.current = -1;
    turnStartBlockCountRef.current = 0;
    accumulatedInputJsonRef.current = '';
  }, [flushPendingDeltas, updateMessage]);

  // addUserMessage - 로컬 상태 조작만 (bridge.send 하지 않음)
  const addUserMessage = useCallback((content: string, context?: Context[], attachments?: Attachment[]) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;
    if (isStreaming) return;

    setError(null);
    setIsStopped(false);

    // Build content: string if no attachments, ContentBlock[] if attachments
    // isContentBlockArray() type guard는 duck-typing이므로 plain object도 통과한다.
    // ImageAttachments 컴포넌트도 속성 접근만 하므로 plain object로 충분하다.
    let messageContent: string | AnyContentBlockDto[];
    if (attachments && attachments.length > 0) {
      const blocks: AnyContentBlockDto[] = [];
      if (content.trim()) {
        blocks.push({ type: ContentBlockType.Text, text: content.trim() } as TextBlockDto);
      }
      for (const att of attachments) {
        blocks.push({
          type: ContentBlockType.Image,
          source: {
            type: 'base64',
            media_type: att.mimeType,
            data: att.base64,
          } as ImageSourceDto,
        } as ImageBlockDto);
      }
      messageContent = blocks;
    } else {
      messageContent = content.trim();
    }

    // Create user message in JSONL structure
    const userMessage: LoadedMessageDto = {
      type: LoadedMessageType.User,
      uuid: generateMessageId(),
      timestamp: new Date().toISOString(),
      message: { role: MessageRole.User, content: messageContent } as any,
      context,
    };
    appendMessage(userMessage);

    // Create assistant placeholder
    const assistantMessageId = generateMessageId();
    const assistantMessage: LoadedMessageDto = {
      type: LoadedMessageType.Assistant,
      uuid: assistantMessageId,
      timestamp: new Date().toISOString(),
      message: { role: MessageRole.Assistant, content: [] } as any,
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
            pendingTextRef.current += mockResponse[charIndex];
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
      // .filter(raw => raw.type === LoadedMessageType.User || raw.type === LoadedMessageType.Assistant)
      .map(raw => toInstance(LoadedMessageDto, raw));

    // Build active chain by tracing parentUuid from the last message
    const activeMessages = filterActiveChain(convertedMessages);

    setMessages(activeMessages);
    setError(null);
    console.log('[useChatStream] Loaded messages:', convertedMessages.length, '→ active chain:', activeMessages.length);
  }, []);

  // Retry
  const retry = useCallback((messageId: string) => {
    const messageIndex = messages.findIndex(m => m.uuid === messageId);
    if (messageIndex === -1) return;

    // Find the last user message before this message
    let userMessage: LoadedMessageDto | null = null;
    for (let i = messageIndex; i >= 0; i--) {
      if (messages[i].type === LoadedMessageType.User) {
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
    endStreaming();
  }, [endStreaming]);

  // Continue
  const continueGeneration = useCallback(() => {
    setIsStopped(false);
  }, []);

  // Reset all stream-related internal state (for clear conversation)
  const resetStreamState = useCallback(() => {
    setIsStopped(false);
    setSystemInit(null);
    setContextWindowUsage(null);
    setIsStreaming(false);
    setStreamingMessageId(null);
    streamingMessageIdRef.current = null;
    pendingTextRef.current = '';
    pendingThinkingRef.current = '';
    pendingInputJsonRef.current = '';
    accumulatedInputJsonRef.current = '';
    activeBlockIndexRef.current = -1;
    activeTextBlockIndexRef.current = -1;
    activeThinkingBlockIndexRef.current = -1;
    activeToolUseBlockIndexRef.current = -1;
    turnStartBlockCountRef.current = 0;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (devModeTimeoutRef.current) {
      clearTimeout(devModeTimeoutRef.current);
      devModeTimeoutRef.current = null;
    }
    if (devModeIntervalRef.current) {
      clearInterval(devModeIntervalRef.current);
      devModeIntervalRef.current = null;
    }
  }, []);

  // Subscribe to Kotlin events
  useEffect(() => {
    // STREAM_EVENT handler
    const unsubscribeStreamEvent = bridge.subscribe('STREAM_EVENT', (message) => {
      const payload = message.payload;

      // 시스템 메시지 판별
      if (payload?.eventType === 'system') {
        if (payload.subtype === 'init') {
          setSystemInit(payload as Record<string, unknown>);
        }
        onSystemMessageRef.current?.(payload as Record<string, unknown>);
        return;
      }

      const event = payload?.event as string | undefined;
      const delta = payload?.delta as Record<string, unknown> | undefined;

      // content_block_start: 새로운 content block 시작
      if (event === 'content_block_start') {
        ensureStreamingPlaceholder();

        const contentBlock = payload?.content_block as { type: ContentBlockType; id?: string; name?: string; text?: string; thinking?: string; input?: Record<string, unknown> } | undefined;
        const blockIndex = payload?.index as number | undefined;
        if (!contentBlock) return;

        if (blockIndex !== undefined) {
          activeBlockIndexRef.current = blockIndex;
        }

        // content 배열에 새 블록을 push하고 활성 인덱스를 기록
        setMessages(prev => prev.map(msg => {
          if (msg.uuid !== streamingMessageIdRef.current) return msg;

          const currentBlocks: AnyContentBlockDto[] = Array.isArray(msg.message?.content)
            ? [...msg.message!.content]
            : [];

          if (contentBlock.type === ContentBlockType.Text) {
            const newBlock: TextBlockDto = { type: ContentBlockType.Text, text: contentBlock.text ?? '' } as TextBlockDto;
            currentBlocks.push(newBlock);
            activeTextBlockIndexRef.current = currentBlocks.length - 1;
          } else if (contentBlock.type === ContentBlockType.ToolUse) {
            const newBlock: ToolUseBlockDto = {
              type: ContentBlockType.ToolUse,
              id: contentBlock.id ?? '',
              name: contentBlock.name ?? '',
              input: contentBlock.input ?? {},
            } as ToolUseBlockDto;
            currentBlocks.push(newBlock);
            activeToolUseBlockIndexRef.current = currentBlocks.length - 1;
            // Reset accumulated input JSON for new tool_use block
            accumulatedInputJsonRef.current = '';
          } else if (contentBlock.type === ContentBlockType.Thinking) {
            const newBlock: ThinkingBlockDto = { type: ContentBlockType.Thinking, thinking: contentBlock.thinking ?? '' } as ThinkingBlockDto;
            currentBlocks.push(newBlock);
            activeThinkingBlockIndexRef.current = currentBlocks.length - 1;
          }

          return { ...msg, message: { ...msg.message!, content: currentBlocks } };
        }));
        return;
      }

      // content_block_stop: 현재 블록 종료
      if (event === 'content_block_stop') {
        activeBlockIndexRef.current = -1;
        // Flush any remaining delta for the completed block
        if (pendingTextRef.current || pendingThinkingRef.current || pendingInputJsonRef.current) {
          flushPendingDeltas();
        }
        return;
      }

      // content_block_delta 처리
      if (!delta) return;

      // text_delta 처리
      if (delta.type === 'text_delta' && delta.text) {
        ensureStreamingPlaceholder();
        pendingTextRef.current += delta.text as string;
        scheduleFlush();
      }

      // thinking_delta 처리
      if (delta.type === 'thinking_delta' && delta.thinking) {
        ensureStreamingPlaceholder();
        pendingThinkingRef.current += delta.thinking as string;
        scheduleFlush();
      }

      // input_json_delta 처리 (tool_use의 input 축적)
      if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
        ensureStreamingPlaceholder();
        pendingInputJsonRef.current += delta.partial_json;
        scheduleFlush();
      }

      // tool_use_delta 처리 (일부 백엔드에서 이 타입으로 올 수 있음)
      if (delta.type === 'tool_use_delta') {
        // tool_use_delta는 보통 content_block_start에서 이미 처리됨
        // partial_json이 있으면 input_json_delta와 동일하게 처리
        if (typeof delta.partial_json === 'string') {
          ensureStreamingPlaceholder();
          pendingInputJsonRef.current += delta.partial_json;
          scheduleFlush();
        }
      }
    });

    // ASSISTANT_MESSAGE handler
    // 에이전트 루프에서 각 턴마다 해당 턴의 content만 포함하여 발생.
    // 이전 턴의 블록을 보존하면서 현재 턴의 스트리밍 블록을 최종 버전으로 교체.
    const unsubscribeAssistantMessage = bridge.subscribe('ASSISTANT_MESSAGE', (message) => {
      const payload = message.payload;
      const messageId = payload?.messageId as string;
      const incomingContent = payload?.content;
      const assistantModel = payload?.model as string | null;
      const assistantUsage = payload?.usage as { input_tokens?: number; output_tokens?: number } | null;
      if (assistantUsage && typeof assistantUsage.input_tokens === 'number') {
        setContextWindowUsage({
          inputTokens: assistantUsage.input_tokens,
          outputTokens: assistantUsage.output_tokens ?? 0,
          model: assistantModel,
        });
      }

      if (!incomingContent || !Array.isArray(incomingContent)) return;
      const finalTurnBlocks = incomingContent as AnyContentBlockDto[];

      if (streamingMessageIdRef.current) {
        // Flush any pending deltas before replacing
        if (pendingTextRef.current || pendingThinkingRef.current || pendingInputJsonRef.current) {
          flushPendingDeltas();
        }

        // Replace current turn's streaming blocks with final blocks from ASSISTANT_MESSAGE.
        // Blocks before turnStartBlockCountRef are from previous turns and must be preserved.
        const turnStart = turnStartBlockCountRef.current;

        setMessages(prev => prev.map(msg => {
          if (msg.uuid !== streamingMessageIdRef.current) return msg;

          const existingBlocks: AnyContentBlockDto[] = Array.isArray(msg.message?.content)
            ? [...msg.message!.content]
            : [];

          // Preserve blocks from previous turns, replace current turn's blocks
          const preservedBlocks = existingBlocks.slice(0, turnStart);
          const mergedBlocks = [...preservedBlocks, ...finalTurnBlocks];

          // Update turnStartBlockCount for the next turn
          turnStartBlockCountRef.current = mergedBlocks.length;

          return {
            ...msg,
            message: { ...msg.message!, content: mergedBlocks },
            isStreaming: false,
            message_id: messageId,
          };
        }));

        // Reset active block indices (this turn is done, next turn may start new blocks)
        activeBlockIndexRef.current = -1;
        activeTextBlockIndexRef.current = -1;
        activeThinkingBlockIndexRef.current = -1;
        activeToolUseBlockIndexRef.current = -1;
        accumulatedInputJsonRef.current = '';
        // NOTE: streamingMessageIdRef is NOT reset here - next turn's stream_event
        // may continue with the same message. Only RESULT_MESSAGE resets it.
      } else {
        // 새 메시지 추가 (스트리밍 없이 바로 온 경우)
        const assistantMessage: LoadedMessageDto = {
          type: LoadedMessageType.Assistant,
          uuid: generateMessageId(),
          timestamp: new Date().toISOString(),
          message: { role: MessageRole.Assistant, content: finalTurnBlocks } as LoadedMessageDto['message'],
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
      if ((pendingTextRef.current || pendingThinkingRef.current || pendingInputJsonRef.current) && streamingMessageIdRef.current) {
        flushPendingDeltas();
      }

      // 에러 처리
      if (errorData) {
        const err = new Error(errorData.message || 'Unknown error');
        setError(err);
        onErrorRef.current?.(err);
      }

      // Context window usage 추출
      const usageData = payload?.usage as { input_tokens?: number; output_tokens?: number } | null;
      const modelStr = payload?.model as string | null;
      if (usageData && typeof usageData.input_tokens === 'number') {
        setContextWindowUsage({
          inputTokens: usageData.input_tokens,
          outputTokens: usageData.output_tokens ?? 0,
          model: modelStr,
        });
      }

      // 스트리밍 종료
      endStreaming();
    });

    // SERVICE_ERROR handler
    const unsubscribeServiceError = bridge.subscribe('SERVICE_ERROR', (message) => {
      const payload = message.payload;
      const errorType = payload?.type as string | undefined;
      const reason = payload?.reason as string | undefined;
      const errorField = payload?.error as string | undefined;

      // 두 가지 페이로드 형식 지원:
      // 형식 1 (close handler): { type: 'CLI_EXIT_ERROR', reason: '...', error: '...' }
      // 형식 2 (spawn error):   { error: '...' }
      const errorMessage = reason || errorField || 'Unknown service error';
      const err = new Error(
        errorType
          ? `Service error: ${errorType} - ${errorMessage}`
          : `Service error: ${errorMessage}`
      );
      setError(err);
      onErrorRef.current?.(err);
      endStreaming();
    });

    // USER_MESSAGE_BROADCAST handler — 다른 탭에서 보낸 사용자 메시지 수신
    const unsubscribeUserBroadcast = bridge.subscribe('USER_MESSAGE_BROADCAST', (message: IPCMessage) => {
      const content = message.payload?.content as string;
      if (!content) return;

      const userMessage: LoadedMessageDto = {
        type: LoadedMessageType.User,
        uuid: generateMessageId(),
        timestamp: new Date().toISOString(),
        message: { role: MessageRole.User, content } as any,
      };
      appendMessage(userMessage);
    });

    // PROGRESS_MESSAGE handler — sub-agent progress (Task 블록의 자식 도구 호출)
    const unsubscribeProgress = bridge.subscribe('PROGRESS_MESSAGE', (message: IPCMessage) => {
      const payload = message.payload;
      if (!payload) return;

      const progressEntry: LoadedMessageDto = {
        type: LoadedMessageType.Progress,
        uuid: (payload.uuid as string) || generateMessageId(),
        parentToolUseID: payload.parentToolUseID as string,
        data: payload.data as any,
        timestamp: (payload.timestamp as string) ?? new Date().toISOString(),
      };
      appendMessage(progressEntry);
    });

    // STREAM_END handler — 스트림 종료 안전망
    // RESULT_MESSAGE나 SERVICE_ERROR가 도착하지 않은 경우에도 스트리밍 상태를 정리
    const unsubscribeStreamEnd = bridge.subscribe('STREAM_END', () => {
      if (streamingMessageIdRef.current) {
        console.warn('[useChatStream] STREAM_END received while still streaming — ending stream as safety net');
        endStreaming();
      }
    });

    // Cleanup
    return () => {
      unsubscribeStreamEvent();
      unsubscribeAssistantMessage();
      unsubscribeResultMessage();
      unsubscribeServiceError();
      unsubscribeUserBroadcast();
      unsubscribeProgress();
      unsubscribeStreamEnd();
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
    resetStreamState,
    systemInit,
    contextWindowUsage,
  };
}
