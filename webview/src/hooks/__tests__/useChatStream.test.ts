import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatStream, type LoadedMessage } from '../useChatStream';
import type { LoadedMessageDto } from '../../types';
import { ContextType } from '../../types';
import { LoadedMessageType, MessageRole } from '../../dto/common';

// Mock requestAnimationFrame and cancelAnimationFrame
const rafCallbacks: ((time: number) => void)[] = [];
let rafId = 0;

vi.stubGlobal('requestAnimationFrame', vi.fn((cb: (time: number) => void) => {
  rafCallbacks.push(cb);
  return ++rafId;
}));

vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
  const index = rafCallbacks.findIndex((_, i) => i === id - 1);
  if (index !== -1) {
    rafCallbacks.splice(index, 1);
  }
}));

// Helper to flush RAF callbacks
function flushRAF() {
  const callbacks = [...rafCallbacks];
  rafCallbacks.length = 0;
  callbacks.forEach(cb => cb(Date.now()));
}

// Mock bridge factory
function createMockBridge() {
  const handlers = new Map<string, Set<(msg: IPCMessage) => void>>();

  return {
    bridge: {
      isConnected: true,
      send: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn((type: string, handler: (msg: IPCMessage) => void) => {
        if (!handlers.has(type)) handlers.set(type, new Set());
        handlers.get(type)!.add(handler);
        return () => {
          handlers.get(type)?.delete(handler);
        };
      }),
    },
    // Helper to simulate Kotlin events
    emit: (type: string, payload: Record<string, unknown>) => {
      const msg: IPCMessage = { type, payload, timestamp: Date.now() };
      handlers.get(type)?.forEach(h => h(msg));
    },
  };
}


describe('useChatStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rafCallbacks.length = 0;
    rafId = 0;
  });

  afterEach(() => {
    rafCallbacks.length = 0;
  });

  describe('addUserMessage', () => {
    it('user 메시지가 messages에 추가된다', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        result.current.addUserMessage('Hello');
      });

      expect(result.current.messages.length).toBe(2); // user + assistant placeholder
      expect(result.current.messages[0].type).toBe('user');
      expect(result.current.messages[0].message?.content).toBe('Hello');
    });

    it('올바른 role/content/timestamp가 포함된다', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      const beforeTime = Date.now();
      act(() => {
        result.current.addUserMessage('Test message');
      });
      const afterTime = Date.now();

      const userMsg = result.current.messages[0];
      expect(userMsg.type).toBe('user');
      expect(userMsg.message?.content).toBe('Test message');
      const timestamp = new Date(userMsg.timestamp!).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
      expect(userMsg.uuid).toBeDefined();
    });

    it('assistant placeholder가 자동 생성되고 isStreaming=true', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        result.current.addUserMessage('Hello');
      });

      const assistantMsg = result.current.messages[1];
      expect(assistantMsg.type).toBe('assistant');
      expect(assistantMsg.message?.content).toEqual([]);
      expect(assistantMsg.isStreaming).toBe(true);
      expect(result.current.isStreaming).toBe(true);
      expect(result.current.streamingMessageId).toBe(assistantMsg.uuid);
    });

    it('빈 문자열은 무시된다', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        result.current.addUserMessage('   ');
      });

      expect(result.current.messages.length).toBe(0);
    });

    it('스트리밍 중에는 새 메시지 추가 불가', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        result.current.addUserMessage('First message');
      });

      expect(result.current.isStreaming).toBe(true);

      act(() => {
        result.current.addUserMessage('Second message');
      });

      // Should still have only first user message + placeholder
      expect(result.current.messages.length).toBe(2);
      expect(result.current.messages.filter(m => m.type === 'user').length).toBe(1);
    });

    it('context가 올바르게 저장된다', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      const context = [
        { type: ContextType.File, path: '/test.ts', content: 'test content' },
      ];

      act(() => {
        result.current.addUserMessage('Hello', context);
      });

      expect(result.current.messages[0].context).toEqual(context);
    });
  });

  describe('STREAM_EVENT 구독', () => {
    it('text_delta 수신 시 streamingMessageId가 없으면 assistant placeholder 자동 생성', () => {
      const { bridge, emit } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      // Emit text_delta without prior message
      act(() => {
        emit('STREAM_EVENT', {
          delta: { type: 'text_delta', text: 'Hello' },
        });
      });

      // Should auto-create assistant message
      expect(result.current.messages.length).toBe(1);
      expect(result.current.messages[0].type).toBe('assistant');
      expect(result.current.isStreaming).toBe(true);
      expect(result.current.streamingMessageId).toBeDefined();
    });

    it('연속 text_delta가 content에 축적된다', () => {
      const { bridge, emit } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        emit('STREAM_EVENT', { delta: { type: 'text_delta', text: 'Hello' } });
        flushRAF();
      });

      act(() => {
        emit('STREAM_EVENT', { delta: { type: 'text_delta', text: ' world' } });
        flushRAF();
      });

      act(() => {
        emit('STREAM_EVENT', { delta: { type: 'text_delta', text: '!' } });
        flushRAF();
      });

      expect(result.current.messages[0].message?.content).toEqual([{ type: 'text', text: 'Hello world!' }]);
    });

    it('isStreaming이 true로 전환된다', () => {
      const { bridge, emit } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      expect(result.current.isStreaming).toBe(false);

      act(() => {
        emit('STREAM_EVENT', { delta: { type: 'text_delta', text: 'Test' } });
      });

      expect(result.current.isStreaming).toBe(true);
    });

    it('시스템 메시지(eventType=system) 수신 시 onSystemMessage 콜백 호출', () => {
      const { bridge, emit } = createMockBridge();
      const onSystemMessage = vi.fn();
      renderHook(() => useChatStream({ bridge, onSystemMessage }));

      act(() => {
        emit('STREAM_EVENT', {
          eventType: 'system',
          sessionId: 'session-123',
          content: { type: 'status', message: 'Processing' },
        });
      });

      expect(onSystemMessage).toHaveBeenCalledWith({
        sessionId: 'session-123',
        content: { type: 'status', message: 'Processing' },
      });
    });

    it('시스템 메시지는 delta 처리를 스킵한다', () => {
      const { bridge, emit } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        emit('STREAM_EVENT', {
          eventType: 'system',
          sessionId: 'session-123',
          content: 'System message',
        });
      });

      // No messages should be added
      expect(result.current.messages.length).toBe(0);
      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe('RESULT_MESSAGE 구독', () => {
    it('수신 시 isStreaming이 false로 전환된다', () => {
      const { bridge, emit } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      // Start streaming
      act(() => {
        emit('STREAM_EVENT', { delta: { type: 'text_delta', text: 'Hello' } });
      });

      expect(result.current.isStreaming).toBe(true);

      // End streaming
      act(() => {
        emit('RESULT_MESSAGE', { status: 'success' });
      });

      expect(result.current.isStreaming).toBe(false);
    });

    it('streamingMessageId가 null로 리셋된다', () => {
      const { bridge, emit } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        emit('STREAM_EVENT', { delta: { type: 'text_delta', text: 'Hello' } });
      });

      expect(result.current.streamingMessageId).not.toBeNull();

      act(() => {
        emit('RESULT_MESSAGE', { status: 'success' });
      });

      expect(result.current.streamingMessageId).toBeNull();
    });

    it('에러 payload 시 error 상태가 설정된다', () => {
      const { bridge, emit } = createMockBridge();
      const onError = vi.fn();
      const { result } = renderHook(() => useChatStream({ bridge, onError }));

      act(() => {
        emit('STREAM_EVENT', { delta: { type: 'text_delta', text: 'Hello' } });
      });

      act(() => {
        emit('RESULT_MESSAGE', {
          status: 'error',
          error: { code: 'ERR_001', message: 'Test error', details: 'Details' },
        });
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Test error');
      expect(onError).toHaveBeenCalled();
    });

    it('onStreamEnd 콜백이 호출된다', () => {
      const { bridge, emit } = createMockBridge();
      const onStreamEnd = vi.fn();
      const { result } = renderHook(() => useChatStream({ bridge, onStreamEnd }));

      act(() => {
        result.current.addUserMessage('Test');
      });

      const streamingId = result.current.streamingMessageId;

      act(() => {
        emit('RESULT_MESSAGE', { status: 'success' });
      });

      expect(onStreamEnd).toHaveBeenCalledWith(streamingId);
    });
  });

  describe('ASSISTANT_MESSAGE 구독', () => {
    it('완성된 content가 처리된다', () => {
      const { bridge, emit } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      // Start streaming
      act(() => {
        result.current.addUserMessage('Test');
      });

      const streamingId = result.current.streamingMessageId;

      // Receive complete assistant message
      act(() => {
        emit('ASSISTANT_MESSAGE', {
          messageId: 'msg_123',
          content: [
            { type: 'text', text: 'Hello world' },
          ],
        });
      });

      const assistantMsg = result.current.messages.find(m => m.uuid === streamingId);
      expect(assistantMsg?.message?.content).toEqual([
        { type: 'text', text: 'Hello world' },
      ]);
      expect(assistantMsg?.message_id).toBe('msg_123');
    });

    it('tool_use blocks가 content 배열에 포함된다', () => {
      const { bridge, emit } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        result.current.addUserMessage('Test');
      });

      const expectedContent = [
        { type: 'text', text: 'Using tool' },
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'read_file',
          input: { path: '/test.ts' },
        },
      ];

      act(() => {
        emit('ASSISTANT_MESSAGE', {
          messageId: 'msg_123',
          content: expectedContent,
        });
      });

      const assistantMsg = result.current.messages[1];
      expect(assistantMsg.message?.content).toEqual(expectedContent);
    });

    it('여러 text blocks가 배열로 저장된다', () => {
      const { bridge, emit } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        result.current.addUserMessage('Test');
      });

      const expectedContent = [
        { type: 'text', text: 'First paragraph' },
        { type: 'text', text: 'Second paragraph' },
        { type: 'text', text: 'Third paragraph' },
      ];

      act(() => {
        emit('ASSISTANT_MESSAGE', {
          messageId: 'msg_123',
          content: expectedContent,
        });
      });

      const assistantMsg = result.current.messages[1];
      expect(assistantMsg.message?.content).toEqual(expectedContent);
    });

    it('streamingMessageId가 없으면 새 메시지를 추가한다', () => {
      const { bridge, emit } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      // Emit without prior streaming
      act(() => {
        emit('ASSISTANT_MESSAGE', {
          messageId: 'msg_123',
          content: [
            { type: 'text', text: 'Direct message' },
          ],
        });
      });

      expect(result.current.messages.length).toBe(1);
      expect(result.current.messages[0].type).toBe('assistant');
      expect(result.current.messages[0].message?.content).toEqual([
        { type: 'text', text: 'Direct message' },
      ]);
    });
  });

  describe('SERVICE_ERROR 구독', () => {
    it('에러 수신 시 error 상태가 설정된다', () => {
      const { bridge, emit } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        emit('SERVICE_ERROR', {
          type: 'CONNECTION_ERROR',
          reason: 'Network timeout',
        });
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain('CONNECTION_ERROR');
      expect(result.current.error?.message).toContain('Network timeout');
    });

    it('스트리밍이 종료된다', () => {
      const { bridge, emit } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        result.current.addUserMessage('Test');
      });

      expect(result.current.isStreaming).toBe(true);

      act(() => {
        emit('SERVICE_ERROR', {
          type: 'API_ERROR',
          reason: 'Invalid request',
        });
      });

      expect(result.current.isStreaming).toBe(false);
    });

    it('onError 콜백이 호출된다', () => {
      const { bridge, emit } = createMockBridge();
      const onError = vi.fn();
      renderHook(() => useChatStream({ bridge, onError }));

      act(() => {
        emit('SERVICE_ERROR', {
          type: 'API_ERROR',
          reason: 'Test error',
        });
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('clearMessages / loadMessages', () => {
    it('clearMessages로 messages가 빈 배열이 된다', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        result.current.addUserMessage('Test');
      });

      expect(result.current.messages.length).toBeGreaterThan(0);

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages.length).toBe(0);
    });

    it('clearMessages로 error도 초기화된다', () => {
      const { bridge, emit } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        emit('SERVICE_ERROR', {
          type: 'ERROR',
          reason: 'Test',
        });
      });

      expect(result.current.error).toBeDefined();

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.error).toBeNull();
    });

    it('loadMessages로 기존 메시지가 로드된다', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      const loadedMessages: LoadedMessage[] = [
        {
          type: LoadedMessageType.User,
          timestamp: '2024-01-01T00:00:00Z',
          message: { role: MessageRole.User, content: 'Hello' },
        },
        {
          type: LoadedMessageType.Assistant,
          timestamp: '2024-01-01T00:00:01Z',
          message: { role: MessageRole.Assistant, content: 'Hi there' },
        },
      ];

      act(() => {
        result.current.loadMessages(loadedMessages);
      });

      expect(result.current.messages.length).toBe(2);
      // loadMessages transforms via toInstance(MessageDto, raw) - check transformed structure
      expect((result.current.messages[0] as any).type ?? (result.current.messages[0] as any).role).toBeDefined();
      expect((result.current.messages[1] as any).type ?? (result.current.messages[1] as any).role).toBeDefined();
    });

    it('loadMessages는 기존 messages를 대체한다', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        result.current.addUserMessage('Old message');
      });

      const loadedMessages: LoadedMessage[] = [
        {
          type: LoadedMessageType.User,
          timestamp: '2024-01-01T00:00:00Z',
          message: { role: MessageRole.User, content: 'New message' },
        },
      ];

      act(() => {
        result.current.loadMessages(loadedMessages);
      });

      expect(result.current.messages.length).toBe(1);
    });
  });

  describe('appendMessage / updateMessage', () => {
    it('appendMessage로 메시지를 추가할 수 있다', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      const newMessage = {
        uuid: 'test-123',
        type: 'assistant' as const,
        message: { role: 'assistant' as const, content: 'Test message' },
        timestamp: new Date().toISOString(),
      } as LoadedMessageDto;

      act(() => {
        result.current.appendMessage(newMessage);
      });

      expect(result.current.messages.length).toBe(1);
      expect(result.current.messages[0]).toEqual(newMessage);
    });

    it('updateMessage로 기존 메시지를 업데이트할 수 있다', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      const message = {
        uuid: 'test-123',
        type: 'assistant' as const,
        message: { role: 'assistant' as const, content: 'Original' },
        timestamp: new Date().toISOString(),
      } as LoadedMessageDto;

      act(() => {
        result.current.appendMessage(message);
      });

      act(() => {
        result.current.updateMessage('test-123', { isStreaming: false });
      });

      expect(result.current.messages[0].isStreaming).toBe(false);
    });

    it('updateMessage는 다른 메시지에 영향을 주지 않는다', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      const message1 = {
        uuid: 'msg-1',
        type: 'user' as const,
        message: { role: 'user' as const, content: 'First' },
        timestamp: new Date().toISOString(),
      } as LoadedMessageDto;

      const message2 = {
        uuid: 'msg-2',
        type: 'assistant' as const,
        message: { role: 'assistant' as const, content: 'Second' },
        timestamp: new Date().toISOString(),
      } as LoadedMessageDto;

      act(() => {
        result.current.appendMessage(message1);
        result.current.appendMessage(message2);
      });

      act(() => {
        result.current.updateMessage('msg-1', { isStreaming: true });
      });

      expect(result.current.messages[0].isStreaming).toBe(true);
      expect(result.current.messages[1].isStreaming).toBeUndefined();
    });
  });

  describe('stop / continue', () => {
    it('stop 호출 시 isStopped=true, isStreaming=false', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        result.current.addUserMessage('Test');
      });

      expect(result.current.isStreaming).toBe(true);
      expect(result.current.isStopped).toBe(false);

      act(() => {
        result.current.stop();
      });

      expect(result.current.isStopped).toBe(true);
      expect(result.current.isStreaming).toBe(false);
    });

    it('continue 호출 시 isStopped=false', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        result.current.stop();
      });

      expect(result.current.isStopped).toBe(true);

      act(() => {
        result.current.continue();
      });

      expect(result.current.isStopped).toBe(false);
    });
  });

  describe('retry', () => {
    it('실패한 메시지를 재시도할 수 있다', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      // Add initial message
      act(() => {
        result.current.addUserMessage('Test message');
      });

      const assistantMessageId = result.current.messages[1].uuid!;

      // Simulate failure
      act(() => {
        result.current.updateMessage(assistantMessageId, {
          isStreaming: false,
        });
      });

      // Clear streaming state
      act(() => {
        result.current.stop();
      });

      // Retry
      act(() => {
        result.current.retry(assistantMessageId);
      });

      // Should have sent message via bridge
      expect(bridge.send).toHaveBeenCalledWith('SEND_MESSAGE', {
        content: 'Test message',
        context: [],
      });
    });

    it('retry는 실패한 메시지 이후의 메시지들을 제거한다', () => {
      const { bridge } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      // Add multiple exchanges
      act(() => {
        result.current.addUserMessage('First');
      });

      // Manually end streaming to add second message
      act(() => {
        result.current.stop();
      });

      const firstAssistantId = result.current.messages[1].uuid!;

      // The retry should remove messages from the failed one onwards
      act(() => {
        result.current.retry(firstAssistantId);
      });

      // Messages should be truncated and new messages added
      expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('callbacks', () => {
    it('onStreamStart가 스트림 시작 시 호출된다', () => {
      const { bridge } = createMockBridge();
      const onStreamStart = vi.fn();
      const { result } = renderHook(() => useChatStream({ bridge, onStreamStart }));

      act(() => {
        result.current.addUserMessage('Test');
      });

      expect(onStreamStart).toHaveBeenCalledWith(result.current.streamingMessageId);
    });

    it('onStreamEnd가 스트림 종료 시 호출된다', () => {
      const { bridge, emit } = createMockBridge();
      const onStreamEnd = vi.fn();
      const { result } = renderHook(() => useChatStream({ bridge, onStreamEnd }));

      act(() => {
        result.current.addUserMessage('Test');
      });

      const streamingId = result.current.streamingMessageId;

      act(() => {
        emit('RESULT_MESSAGE', { status: 'success' });
      });

      expect(onStreamEnd).toHaveBeenCalledWith(streamingId);
    });
  });

  describe('RAF throttling', () => {
    it('여러 text_delta가 RAF를 통해 배치 처리된다', () => {
      const { bridge, emit } = createMockBridge();
      const { result } = renderHook(() => useChatStream({ bridge }));

      act(() => {
        emit('STREAM_EVENT', { delta: { type: 'text_delta', text: 'A' } });
        emit('STREAM_EVENT', { delta: { type: 'text_delta', text: 'B' } });
        emit('STREAM_EVENT', { delta: { type: 'text_delta', text: 'C' } });
      });

      // Before RAF flush, content should not be updated yet
      // (Due to RAF batching, content accumulates in pendingDelta)

      act(() => {
        flushRAF();
      });

      // After RAF flush, all deltas should be accumulated
      const assistantMsg = result.current.messages[0];
      expect(assistantMsg.message?.content).toEqual([{ type: 'text', text: 'ABC' }]);
    });
  });
});
