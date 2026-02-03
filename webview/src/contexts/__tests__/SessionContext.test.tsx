import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import React from 'react';
import { SessionProvider, useSessionContext } from '../SessionContext';
import type { SessionMetaDto } from '../../dto/session/SessionDto';

// Mock contexts
const mockSubscribe = vi.fn(() => vi.fn());
const mockSend = vi.fn();
let mockIsConnected = true;

vi.mock('../BridgeContext', () => ({
  useBridgeContext: () => ({
    subscribe: mockSubscribe,
    send: mockSend,
    isConnected: mockIsConnected,
  }),
}));

// Mock API
const mockSessionsIndex = vi.fn();
const mockSessionsShow = vi.fn();
const mockSessionsDestroy = vi.fn();
const mockSessionsActivate = vi.fn();
const mockSessionsCreate = vi.fn();
const mockSetWorkingDir = vi.fn();

const mockApi = {
  sessions: {
    index: mockSessionsIndex,
    show: mockSessionsShow,
    destroy: mockSessionsDestroy,
    activate: mockSessionsActivate,
    create: mockSessionsCreate,
  },
  setWorkingDir: mockSetWorkingDir,
};

vi.mock('../ApiContext', () => ({
  useApi: () => mockApi,
}));

// Test data
const mockSessionDtos: SessionMetaDto[] = [
  {
    id: 'session-1',
    title: 'Chat 1',
    createdAt: new Date('2026-02-02T10:00:00Z'),
    updatedAt: new Date('2026-02-02T11:00:00Z'),
    messageCount: 5,
  },
  {
    id: 'session-2',
    title: 'Chat 2',
    createdAt: new Date('2026-02-01T09:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    messageCount: 3,
  },
];

const mockMessages = [
  {
    role: 'user' as const,
    content: 'Hello',
    timestamp: '2026-02-02T10:00:00Z',
  },
  {
    role: 'assistant' as const,
    content: 'Hi there',
    timestamp: '2026-02-02T10:01:00Z',
  },
];

// Test helper component
interface TestConsumerProps {
  onMount: (ctx: ReturnType<typeof useSessionContext>) => void;
}

function TestConsumer({ onMount }: TestConsumerProps) {
  const ctx = useSessionContext();
  React.useEffect(() => {
    onMount(ctx);
  }, [onMount, ctx]);
  return null;
}

describe('SessionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConnected = true;
    mockSessionsIndex.mockResolvedValue([]);
    mockSessionsShow.mockResolvedValue({ messages: [] });
    mockSessionsDestroy.mockResolvedValue(undefined);
    mockSessionsActivate.mockResolvedValue(undefined);
    mockSessionsCreate.mockResolvedValue(undefined);
  });

  it('loadSessions - API 호출 후 sessions 상태 업데이트', async () => {
    mockSessionsIndex.mockResolvedValue(mockSessionDtos);

    let capturedCtx: ReturnType<typeof useSessionContext> | null = null;

    render(
      <SessionProvider>
        <TestConsumer onMount={(ctx) => { capturedCtx = ctx; }} />
      </SessionProvider>
    );

    await act(async () => {
      await capturedCtx?.loadSessions();
    });

    expect(mockSessionsIndex).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(capturedCtx?.sessions).toHaveLength(2);
      expect(capturedCtx?.sessions[0].id).toBe('session-1');
      expect(capturedCtx?.sessions[0].title).toBe('Chat 1');
      expect(capturedCtx?.sessions[1].id).toBe('session-2');
    });
  });

  it('loadSessions - 미연결 시 API 호출 안 함', async () => {
    mockIsConnected = false;

    let capturedCtx: ReturnType<typeof useSessionContext> | null = null;

    render(
      <SessionProvider>
        <TestConsumer onMount={(ctx) => { capturedCtx = ctx; }} />
      </SessionProvider>
    );

    await act(async () => {
      await capturedCtx?.loadSessions();
    });

    expect(mockSessionsIndex).not.toHaveBeenCalled();
    expect(capturedCtx!.sessions).toHaveLength(0);
  });

  it('switchSession - 성공 시 currentSessionId 업데이트 및 메시지 로드', async () => {
    mockSessionsIndex.mockResolvedValue(mockSessionDtos);
    mockSessionsShow.mockResolvedValue({ messages: mockMessages });

    const onMessagesLoaded = vi.fn();
    const onSessionChange = vi.fn();
    let capturedCtx: ReturnType<typeof useSessionContext> | null = null;

    render(
      <SessionProvider onMessagesLoaded={onMessagesLoaded} onSessionChange={onSessionChange}>
        <TestConsumer onMount={(ctx) => { capturedCtx = ctx; }} />
      </SessionProvider>
    );

    await act(async () => {
      await capturedCtx?.loadSessions();
    });

    await act(async () => {
      await capturedCtx?.switchSession('session-1');
    });

    expect(mockSessionsShow).toHaveBeenCalledWith('session-1');
    await waitFor(() => {
      expect(capturedCtx?.currentSessionId).toBe('session-1');
      expect(capturedCtx?.sessionState).toBe('idle');
      expect(onMessagesLoaded).toHaveBeenCalledWith(mockMessages);
      expect(onSessionChange).toHaveBeenCalledWith('session-1');
    });
  });

  it('switchSession - 존재하지 않는 세션 ID로 호출 시 무시', async () => {
    mockSessionsIndex.mockResolvedValue(mockSessionDtos);

    const onSessionChange = vi.fn();
    let capturedCtx: ReturnType<typeof useSessionContext> | null = null;

    render(
      <SessionProvider onSessionChange={onSessionChange}>
        <TestConsumer onMount={(ctx) => { capturedCtx = ctx; }} />
      </SessionProvider>
    );

    await act(async () => {
      await capturedCtx?.loadSessions();
    });

    await act(async () => {
      await capturedCtx?.switchSession('non-existent-id');
    });

    expect(mockSessionsShow).not.toHaveBeenCalled();
    expect(capturedCtx!.currentSessionId).toBeNull();
    expect(onSessionChange).not.toHaveBeenCalled();
  });

  it('deleteSession - 성공 시 sessions에서 제거', async () => {
    mockSessionsIndex.mockResolvedValue(mockSessionDtos);

    let capturedCtx: ReturnType<typeof useSessionContext> | null = null;

    render(
      <SessionProvider>
        <TestConsumer onMount={(ctx) => { capturedCtx = ctx; }} />
      </SessionProvider>
    );

    await act(async () => {
      await capturedCtx?.loadSessions();
    });

    await act(async () => {
      await capturedCtx?.deleteSession('session-2');
    });

    expect(mockSessionsDestroy).toHaveBeenCalledWith('session-2');
    await waitFor(() => {
      expect(capturedCtx?.sessions).toHaveLength(1);
      expect(capturedCtx?.sessions[0].id).toBe('session-1');
    });
  });

  it('deleteSession - 현재 세션 삭제 시 currentSessionId null로 초기화', async () => {
    mockSessionsIndex.mockResolvedValue(mockSessionDtos);
    mockSessionsShow.mockResolvedValue({ messages: mockMessages });

    let capturedCtx: ReturnType<typeof useSessionContext> | null = null;

    render(
      <SessionProvider>
        <TestConsumer onMount={(ctx) => { capturedCtx = ctx; }} />
      </SessionProvider>
    );

    await act(async () => {
      await capturedCtx?.loadSessions();
    });

    await act(async () => {
      await capturedCtx?.switchSession('session-1');
    });

    await act(async () => {
      await capturedCtx?.deleteSession('session-1');
    });

    expect(mockSessionsDestroy).toHaveBeenCalledWith('session-1');
    await waitFor(() => {
      expect(capturedCtx?.currentSessionId).toBeNull();
      expect(capturedCtx?.sessionState).toBe('idle');
    });
  });
});
