import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import React from 'react';
import { ChatStreamProvider, useChatStreamContext } from '../contexts/ChatStreamContext';

// Mock requestAnimationFrame/cancelAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => {
  cb(0);
  return 0;
});
global.cancelAnimationFrame = vi.fn();

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock BridgeContext
const mockBridge = {
  isConnected: true,
  send: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn(),
  lastMessage: null,
  connectionStatus: 'connected' as const,
};

vi.mock('../contexts/BridgeContext', () => ({
  useBridgeContext: () => mockBridge,
  BridgeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock SessionContext
const mockSession = {
  currentSessionId: null as string | null,
  sessions: [],
  sessionState: 'idle' as const,
  isLoading: false,
  workingDirectory: '/test',
  loadSessions: vi.fn(),
  resetToNewSession: vi.fn(),
  openNewTab: vi.fn(),
  openSettings: vi.fn(),
  switchSession: vi.fn(),
  deleteSession: vi.fn(),
  renameSession: vi.fn(),
  setSessionState: vi.fn(),
  setWorkingDirectory: vi.fn(),
};

vi.mock('../contexts/SessionContext', () => ({
  useSessionContext: () => mockSession,
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Test component that uses ChatStreamContext
function TestChatComponent() {
  const ctx = useChatStreamContext();
  return (
    <div>
      <div data-testid="messages-count">{ctx.messages.length}</div>
      <div data-testid="is-streaming">{String(ctx.isStreaming)}</div>
      <div data-testid="error">{ctx.error?.message || 'none'}</div>
      <div data-testid="streaming-id">{ctx.streamingMessageId || 'none'}</div>
      <input
        data-testid="input"
        value={ctx.input}
        onChange={(e) => ctx.setInput(e.target.value)}
      />
      <button data-testid="submit" onClick={() => ctx.handleSubmit()}>
        Send
      </button>
      <button data-testid="stop" onClick={ctx.stop}>
        Stop
      </button>
      <button data-testid="continue" onClick={ctx.continue}>
        Continue
      </button>
      <div data-testid="messages">
        {ctx.messages.map((m) => (
          <div key={m.uuid} data-testid={`msg-${m.type}`}>
            {typeof m.message?.content === 'string' ? m.message.content : 'blocks'}
          </div>
        ))}
      </div>
    </div>
  );
}

describe('채팅 스트리밍 통합 테스트', () => {
  const bridgeHandlers = new Map<string, Set<(msg: IPCMessage) => void>>();

  function emitBridgeEvent(type: string, payload: Record<string, unknown>) {
    const msg: IPCMessage = { type, payload, timestamp: Date.now() };
    bridgeHandlers.get(type)?.forEach((h) => h(msg));
  }

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    bridgeHandlers.clear();

    // Setup bridge.subscribe to capture handlers
    mockBridge.subscribe.mockImplementation(
      (type: string, handler: (msg: IPCMessage) => void) => {
        if (!bridgeHandlers.has(type)) {
          bridgeHandlers.set(type, new Set());
        }
        bridgeHandlers.get(type)!.add(handler);
        return () => {
          bridgeHandlers.get(type)?.delete(handler);
        };
      }
    );

    // Reset session mock state
    mockSession.currentSessionId = null;
  });

  afterEach(() => {
    bridgeHandlers.clear();
  });

  it('초기 상태가 올바르다', () => {
    render(
      <ChatStreamProvider>
        <TestChatComponent />
      </ChatStreamProvider>
    );

    expect(screen.getByTestId('messages-count')).toHaveTextContent('0');
    expect(screen.getByTestId('is-streaming')).toHaveTextContent('false');
    expect(screen.getByTestId('error')).toHaveTextContent('none');
    expect(screen.getByTestId('streaming-id')).toHaveTextContent('none');
    expect(screen.getByTestId('input')).toHaveValue('');
  });

  it('sendMessage: user 메시지가 추가되고 bridge.send가 호출된다', async () => {
    mockSession.currentSessionId = 'existing-session';

    render(
      <ChatStreamProvider>
        <TestChatComponent />
      </ChatStreamProvider>
    );

    const input = screen.getByTestId('input');
    const submit = screen.getByTestId('submit');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Hello' } });
    });

    await act(async () => {
      fireEvent.click(submit);
    });

    // addUserMessage creates 2 messages: user + assistant placeholder
    await waitFor(() => {
      expect(screen.getByTestId('messages-count')).toHaveTextContent('2');
    });

    expect(screen.getByTestId('msg-user')).toHaveTextContent('Hello');
    expect(mockBridge.send).toHaveBeenCalledWith('SEND_MESSAGE', {
      content: 'Hello',
      context: [],
    });
    expect(screen.getByTestId('input')).toHaveValue('');
  });

  it('STREAM_EVENT 수신: assistant 메시지에 text가 축적된다', async () => {
    mockSession.currentSessionId = 'test-session';

    render(
      <ChatStreamProvider>
        <TestChatComponent />
      </ChatStreamProvider>
    );

    const input = screen.getByTestId('input');
    const submit = screen.getByTestId('submit');

    // Send user message - creates user + assistant placeholder
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(submit);
    });

    await waitFor(() => {
      expect(screen.getByTestId('messages-count')).toHaveTextContent('2');
    });

    // Simulate stream deltas
    await act(async () => {
      emitBridgeEvent('STREAM_EVENT', {
        delta: {
          type: 'text_delta',
          text: 'Hello',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-streaming')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('messages-count')).toHaveTextContent('2'); // user + assistant
    expect(screen.getByTestId('msg-assistant')).toHaveTextContent('Hello');

    // Simulate more stream chunks
    await act(async () => {
      emitBridgeEvent('STREAM_EVENT', {
        delta: {
          type: 'text_delta',
          text: ' world',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('msg-assistant')).toHaveTextContent('Hello world');
    });
  });

  it('RESULT_MESSAGE 수신: isStreaming이 false로 전환된다', async () => {
    mockSession.currentSessionId = 'test-session';

    render(
      <ChatStreamProvider>
        <TestChatComponent />
      </ChatStreamProvider>
    );

    // Start streaming
    await act(async () => {
      emitBridgeEvent('STREAM_EVENT', {
        delta: {
          type: 'text_delta',
          text: 'Test',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-streaming')).toHaveTextContent('true');
    });

    // End streaming
    await act(async () => {
      emitBridgeEvent('RESULT_MESSAGE', {
        status: 'success',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-streaming')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('streaming-id')).toHaveTextContent('none');
  });

  it('SERVICE_ERROR 수신: error 상태가 설정된다', async () => {
    mockSession.currentSessionId = 'test-session';

    render(
      <ChatStreamProvider>
        <TestChatComponent />
      </ChatStreamProvider>
    );

    await act(async () => {
      emitBridgeEvent('SERVICE_ERROR', {
        type: 'ERROR_TYPE',
        reason: 'API error message',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Service error: ERROR_TYPE - API error message');
    });

    expect(screen.getByTestId('is-streaming')).toHaveTextContent('false');
  });

  it('stop: isStreaming=false, STOP_SESSION이 bridge로 전송된다', async () => {
    mockSession.currentSessionId = 'test-session';

    render(
      <ChatStreamProvider>
        <TestChatComponent />
      </ChatStreamProvider>
    );

    // Start streaming
    await act(async () => {
      emitBridgeEvent('STREAM_EVENT', {
        delta: {
          type: 'text_delta',
          text: 'Test',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-streaming')).toHaveTextContent('true');
    });

    // Stop streaming
    const stopButton = screen.getByTestId('stop');
    await act(async () => {
      fireEvent.click(stopButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-streaming')).toHaveTextContent('false');
    });

    expect(mockBridge.send).toHaveBeenCalledWith('STOP_SESSION', {});
    expect(mockSession.setSessionState).toHaveBeenCalledWith('idle');
  });

  it('전체 흐름: 입력 → sendMessage → STREAM_EVENT → RESULT_MESSAGE → 완료', async () => {
    mockSession.currentSessionId = 'test-session';

    render(
      <ChatStreamProvider>
        <TestChatComponent />
      </ChatStreamProvider>
    );

    const input = screen.getByTestId('input');
    const submit = screen.getByTestId('submit');

    // 1. User inputs message - creates user + assistant placeholder
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Complete test' } });
      fireEvent.click(submit);
    });

    await waitFor(() => {
      expect(screen.getByTestId('messages-count')).toHaveTextContent('2');
    });

    expect(screen.getByTestId('msg-user')).toHaveTextContent('Complete test');

    // 2. Start streaming
    await act(async () => {
      emitBridgeEvent('STREAM_EVENT', {
        delta: {
          type: 'text_delta',
          text: 'Response',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-streaming')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('messages-count')).toHaveTextContent('2');
    expect(screen.getByTestId('msg-assistant')).toHaveTextContent('Response');

    // 3. More stream chunks
    await act(async () => {
      emitBridgeEvent('STREAM_EVENT', {
        delta: {
          type: 'text_delta',
          text: ' part 2',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('msg-assistant')).toHaveTextContent('Response part 2');
    });

    // 4. Complete streaming
    await act(async () => {
      emitBridgeEvent('RESULT_MESSAGE', {
        status: 'success',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-streaming')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('streaming-id')).toHaveTextContent('none');
    expect(screen.getByTestId('error')).toHaveTextContent('none');

    // Verify final state
    expect(screen.getByTestId('messages-count')).toHaveTextContent('2');
    expect(screen.getAllByTestId(/^msg-/).length).toBe(2);
  });
});
