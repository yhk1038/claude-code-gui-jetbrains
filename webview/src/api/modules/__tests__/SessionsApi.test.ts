import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionsApi } from '../SessionsApi';
import type { BridgeClient } from '../../bridge/BridgeClient';
import type { ApiConfig } from '../../ClaudeCodeApi';
import { SessionMetaDto } from '../../../dto';

const createMockBridge = () => ({
  request: vi.fn(),
  waitFor: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
});

const createApi = (bridge: ReturnType<typeof createMockBridge>) => {
  const getConfig = (): ApiConfig => ({ workingDir: '/test/path' });
  return new SessionsApi(bridge as unknown as BridgeClient, getConfig);
};

describe('SessionsApi', () => {
  let mockBridge: ReturnType<typeof createMockBridge>;
  let api: SessionsApi;

  beforeEach(() => {
    mockBridge = createMockBridge();
    api = createApi(mockBridge);
  });

  describe('index()', () => {
    it('should fetch sessions and return SessionMetaDto[]', async () => {
      const mockResponse = {
        sessions: [
          {
            sessionId: 'session-1',
            firstPrompt: 'Hello world',
            created: '2026-02-02T10:00:00Z',
            modified: '2026-02-02T11:00:00Z',
            messageCount: 5,
            projectPath: '/project/path',
            gitBranch: 'main',
          },
          {
            sessionId: 'session-2',
            firstPrompt: 'Test prompt',
            created: '2026-02-01T09:00:00Z',
            modified: '2026-02-01T10:00:00Z',
            messageCount: 3,
          },
        ],
      };

      mockBridge.request.mockResolvedValueOnce(mockResponse);

      const result = await api.index();

      expect(mockBridge.request).toHaveBeenCalledWith('GET_SESSIONS', {
        workingDir: '/test/path',
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(SessionMetaDto);
      expect(result[0].id).toBe('session-1');
      expect(result[0].title).toBe('Hello world');
      expect(result[0].createdAt).toBe('2026-02-02T10:00:00Z');
      expect(result[0].updatedAt).toBe('2026-02-02T11:00:00Z');
      expect(result[0].messageCount).toBe(5);
      expect(result[0].projectPath).toBe('/project/path');
      expect(result[0].gitBranch).toBe('main');
    });

    it('should return empty array when no sessions exist', async () => {
      mockBridge.request.mockResolvedValueOnce({ sessions: [] });

      const result = await api.index();

      expect(result).toEqual([]);
    });

    it('should return empty array when response is invalid', async () => {
      mockBridge.request.mockResolvedValueOnce(null);

      const result = await api.index();

      expect(result).toEqual([]);
    });

    it('should map sessionId to id and firstPrompt to title', async () => {
      const mockResponse = {
        sessions: [
          {
            sessionId: 'test-id',
            firstPrompt: 'This is a very long prompt that should be truncated to 50 characters maximum length',
            created: '2026-01-01T00:00:00Z',
            modified: '2026-01-01T01:00:00Z',
            messageCount: 10,
          },
        ],
      };

      mockBridge.request.mockResolvedValueOnce(mockResponse);

      const result = await api.index();

      expect(result[0].id).toBe('test-id');
      expect(result[0].title).toHaveLength(50);
      expect(result[0].title).toBe(mockResponse.sessions[0].firstPrompt!.substring(0, 50));
    });

    it('should use default title when firstPrompt is null', async () => {
      const mockResponse = {
        sessions: [
          {
            sessionId: 'session-no-prompt',
            firstPrompt: null,
            created: '2026-02-01T09:00:00Z',
            modified: '2026-02-01T10:00:00Z',
            messageCount: 0,
          },
        ],
      };

      mockBridge.request.mockResolvedValueOnce(mockResponse);

      const result = await api.index();

      expect(result[0].title).toBe('No title');
    });

    it('should default messageCount to 0 when not provided', async () => {
      const mockResponse = {
        sessions: [
          {
            sessionId: 'session-3',
            firstPrompt: 'Test',
            created: '2026-02-01T09:00:00Z',
            modified: '2026-02-01T10:00:00Z',
          },
        ],
      };

      mockBridge.request.mockResolvedValueOnce(mockResponse);

      const result = await api.index();

      expect(result[0].messageCount).toBe(0);
    });
  });

  describe('show()', () => {
    it('should load session and return messages', async () => {
      const mockLoadResponse = {
        sessionId: 'session-1',
        messages: [
          {
            type: 'user',
            message: {
              role: 'user',
              content: 'Hello',
            },
            timestamp: '2026-02-02T10:00:00Z',
          },
        ],
      };

      mockBridge.waitFor.mockResolvedValueOnce(mockLoadResponse);
      mockBridge.request.mockResolvedValueOnce(undefined);

      const result = await api.show('session-1');

      expect(mockBridge.waitFor).toHaveBeenCalledWith('SESSION_LOADED', 30000);
      expect(mockBridge.request).toHaveBeenCalledWith('LOAD_SESSION', {
        sessionId: 'session-1',
        workingDir: '/test/path',
      });
      expect(result.sessionId).toBe('session-1');
      expect(result.messages).toBeDefined();
      expect(Array.isArray(result.messages)).toBe(true);
    });

    it('should call waitFor before request', async () => {
      const callOrder: string[] = [];

      mockBridge.waitFor.mockImplementation(() => {
        callOrder.push('waitFor');
        return Promise.resolve({
          sessionId: 'session-1',
          messages: [],
        });
      });

      mockBridge.request.mockImplementation(() => {
        callOrder.push('request');
        return Promise.resolve(undefined);
      });

      await api.show('session-1');

      expect(callOrder).toEqual(['waitFor', 'request']);
    });

    it('should set up message subscription when onMessage is provided', async () => {
      const mockLoadResponse = {
        sessionId: 'session-1',
        messages: [],
      };

      const onMessage = vi.fn();
      mockBridge.waitFor.mockResolvedValueOnce(mockLoadResponse);
      mockBridge.request.mockResolvedValueOnce(undefined);

      await api.show('session-1', onMessage);

      expect(mockBridge.subscribe).toHaveBeenCalledTimes(3);
      expect(mockBridge.subscribe).toHaveBeenCalledWith('STREAM_EVENT', expect.any(Function));
      expect(mockBridge.subscribe).toHaveBeenCalledWith('ASSISTANT_MESSAGE', expect.any(Function));
      expect(mockBridge.subscribe).toHaveBeenCalledWith('RESULT_MESSAGE', expect.any(Function));
    });

    it('should unsubscribe from previous session when loading new session', async () => {
      const unsubscribe1 = vi.fn();
      const unsubscribe2 = vi.fn();

      mockBridge.subscribe.mockReturnValueOnce(unsubscribe1)
        .mockReturnValueOnce(unsubscribe1)
        .mockReturnValueOnce(unsubscribe1)
        .mockReturnValueOnce(unsubscribe2)
        .mockReturnValueOnce(unsubscribe2)
        .mockReturnValueOnce(unsubscribe2);

      mockBridge.waitFor.mockResolvedValue({
        sessionId: 'session-1',
        messages: [],
      });
      mockBridge.request.mockResolvedValue(undefined);

      const onMessage = vi.fn();

      await api.show('session-1', onMessage);
      expect(unsubscribe1).not.toHaveBeenCalled();

      await api.show('session-2', onMessage);
      expect(unsubscribe1).toHaveBeenCalledTimes(3);
    });
  });

  describe('activate()', () => {
    it('should send SESSION_CHANGE request', async () => {
      mockBridge.request.mockResolvedValueOnce(undefined);

      await api.activate('session-1');

      expect(mockBridge.request).toHaveBeenCalledWith('SESSION_CHANGE', {
        sessionId: 'session-1',
      });
    });
  });

  describe('create()', () => {
    it('should send NEW_SESSION request', async () => {
      mockBridge.request.mockResolvedValueOnce(undefined);

      await api.create();

      expect(mockBridge.request).toHaveBeenCalledWith('NEW_SESSION', {});
    });
  });

  describe('destroy()', () => {
    it('should send DELETE_SESSION request', async () => {
      mockBridge.request.mockResolvedValueOnce(undefined);

      await api.destroy('session-1');

      expect(mockBridge.request).toHaveBeenCalledWith('DELETE_SESSION', {
        sessionId: 'session-1',
      });
    });
  });

  describe('onSessionLoaded()', () => {
    it('should subscribe to SESSION_LOADED events', () => {
      const callback = vi.fn();

      api.onSessionLoaded(callback);

      expect(mockBridge.subscribe).toHaveBeenCalledWith('SESSION_LOADED', expect.any(Function));
    });

    it('should transform messages in callback', () => {
      const callback = vi.fn();
      let subscribedCallback: ((message: unknown) => void) | undefined;

      mockBridge.subscribe.mockImplementation(((_event: any, cb: any) => {
        subscribedCallback = cb as (message: unknown) => void;
        return vi.fn();
      }) as any);

      api.onSessionLoaded(callback);

      const mockMessage = {
        payload: {
          sessionId: 'session-1',
          messages: [
            {
              type: 'user',
              message: {
                role: 'user',
                content: 'Test message',
              },
              timestamp: '2026-02-02T10:00:00Z',
            },
          ],
        },
      };

      subscribedCallback?.(mockMessage);

      expect(callback).toHaveBeenCalledWith({
        sessionId: 'session-1',
        messages: expect.any(Array),
      });
    });
  });
});
