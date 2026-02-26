import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
const mockSessionsLoad = vi.fn();
const mockSessionsDestroy = vi.fn();
const mockSessionsCreate = vi.fn();
const mockSetWorkingDir = vi.fn();

const mockApi = {
  sessions: {
    index: mockSessionsIndex,
    load: mockSessionsLoad,
    destroy: mockSessionsDestroy,
    create: mockSessionsCreate,
  },
  setWorkingDir: mockSetWorkingDir,
};

vi.mock('../ApiContext', () => ({
  useApi: () => mockApi,
}));

vi.mock('../../adapters', () => ({
  getAdapter: () => ({
    openNewTab: vi.fn().mockResolvedValue(undefined),
    openSettings: vi.fn().mockResolvedValue(undefined),
  }),
  onBridgeReady: vi.fn(),
}));

// Test data
const mockSessionDtos: SessionMetaDto[] = [
  {
    id: 'session-1',
    title: 'Chat 1',
    createdAt: new Date('2026-02-02T10:00:00Z'),
    updatedAt: new Date('2026-02-02T11:00:00Z'),
    messageCount: 5,
    isSidechain: false,
  },
  {
    id: 'session-2',
    title: 'Chat 2',
    createdAt: new Date('2026-02-01T09:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    messageCount: 3,
    isSidechain: false,
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
    mockSessionsLoad.mockResolvedValue(undefined);
    mockSessionsDestroy.mockResolvedValue(undefined);
    mockSessionsCreate.mockResolvedValue(undefined);
    // URL 파라미터로 workingDir 설정 (SSOT)
    window.history.pushState({}, '', '?workingDir=/test/workspace');
  });

  afterEach(() => {
    // URL 파라미터 초기화
    window.history.pushState({}, '', window.location.pathname);
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

  it('switchSession - 성공 시 currentSessionId 업데이트 및 load 호출', async () => {
    mockSessionsIndex.mockResolvedValue(mockSessionDtos);
    mockSessionsLoad.mockResolvedValue(undefined);

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

    expect(mockSessionsLoad).toHaveBeenCalledWith('session-1');
    await waitFor(() => {
      expect(capturedCtx?.currentSessionId).toBe('session-1');
      expect(capturedCtx?.sessionState).toBe('idle');
    });
  });

  it('switchSession - 존재하지 않는 세션 ID로 호출 시 무시', async () => {
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
      await capturedCtx?.switchSession('non-existent-id');
    });

    expect(mockSessionsLoad).not.toHaveBeenCalled();
    expect(capturedCtx!.currentSessionId).toBeNull();
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
    mockSessionsLoad.mockResolvedValue(undefined);

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

  describe('workingDirectory - URL 파라미터 SSOT', () => {
    it('URL ?workingDir= 파라미터에서 workingDirectory 초기화', async () => {
      window.history.pushState({}, '', '?workingDir=/projects/my-app');

      let capturedCtx: ReturnType<typeof useSessionContext> | null = null;

      render(
        <SessionProvider>
          <TestConsumer onMount={(ctx) => { capturedCtx = ctx; }} />
        </SessionProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.workingDirectory).toBe('/projects/my-app');
      });
      expect(mockSetWorkingDir).toHaveBeenCalledWith('/projects/my-app');
    });

    it('URL에 workingDir 파라미터 없으면 workingDirectory는 null', async () => {
      window.history.pushState({}, '', '/');

      let capturedCtx: ReturnType<typeof useSessionContext> | null = null;

      render(
        <SessionProvider>
          <TestConsumer onMount={(ctx) => { capturedCtx = ctx; }} />
        </SessionProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.workingDirectory).toBeNull();
      });
      expect(mockSetWorkingDir).not.toHaveBeenCalled();
    });

    it('workingDirectory 없으면 loadSessions 호출해도 API 요청 안 함', async () => {
      window.history.pushState({}, '', '/');

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
    });

    it('setWorkingDirectory 호출 시 URL 파라미터도 업데이트', async () => {
      window.history.pushState({}, '', '/');

      let capturedCtx: ReturnType<typeof useSessionContext> | null = null;

      render(
        <SessionProvider>
          <TestConsumer onMount={(ctx) => { capturedCtx = ctx; }} />
        </SessionProvider>
      );

      await act(async () => {
        capturedCtx?.setWorkingDirectory('/new/project');
      });

      await waitFor(() => {
        expect(capturedCtx?.workingDirectory).toBe('/new/project');
      });

      const params = new URLSearchParams(window.location.search);
      expect(params.get('workingDir')).toBe('/new/project');
      expect(mockSetWorkingDir).toHaveBeenCalledWith('/new/project');
    });

    it('URL에 인코딩된 경로가 있어도 정상 디코딩', async () => {
      // URLEncoder.encode()로 인코딩된 경로 시뮬레이션
      window.history.pushState({}, '', '?workingDir=%2FUsers%2Fuser%2FMy%20Project');

      let capturedCtx: ReturnType<typeof useSessionContext> | null = null;

      render(
        <SessionProvider>
          <TestConsumer onMount={(ctx) => { capturedCtx = ctx; }} />
        </SessionProvider>
      );

      await waitFor(() => {
        expect(capturedCtx?.workingDirectory).toBe('/Users/user/My Project');
      });
    });
  });
});
