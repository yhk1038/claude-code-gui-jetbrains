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
            title: 'Hello world',
            createdAt: '2026-02-02T10:00:00Z',
            lastTimestamp: '2026-02-02T11:00:00Z',
            messageCount: 5,
            isSidechain: false,
            projectPath: '/project/path',
            gitBranch: 'main',
          },
          {
            sessionId: 'session-2',
            title: 'Test prompt',
            createdAt: '2026-02-01T09:00:00Z',
            lastTimestamp: '2026-02-01T10:00:00Z',
            messageCount: 3,
            isSidechain: false,
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
      expect(result[0].createdAt).toEqual(new Date('2026-02-02T10:00:00Z'));
      expect(result[0].updatedAt).toEqual(new Date('2026-02-02T11:00:00Z'));
      expect(result[0].messageCount).toBe(5);
      expect(result[0].isSidechain).toBe(false);
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

    it('should map sessionId to id and truncate title to 50 chars', async () => {
      const mockResponse = {
        sessions: [
          {
            sessionId: 'test-id',
            title: 'This is a very long prompt that should be truncated to 50 characters maximum length',
            createdAt: '2026-01-01T00:00:00Z',
            lastTimestamp: '2026-01-01T01:00:00Z',
            messageCount: 10,
            isSidechain: false,
          },
        ],
      };

      mockBridge.request.mockResolvedValueOnce(mockResponse);

      const result = await api.index();

      expect(result[0].id).toBe('test-id');
      expect(result[0].title).toHaveLength(50);
      expect(result[0].title).toBe(mockResponse.sessions[0].title.substring(0, 50));
    });

    it('should use default title when title is empty', async () => {
      const mockResponse = {
        sessions: [
          {
            sessionId: 'session-no-prompt',
            title: '',
            createdAt: '2026-02-01T09:00:00Z',
            lastTimestamp: '2026-02-01T10:00:00Z',
            messageCount: 0,
            isSidechain: false,
          },
        ],
      };

      mockBridge.request.mockResolvedValueOnce(mockResponse);

      const result = await api.index();

      expect(result[0].title).toBe('No title');
    });

    it('should fall back updatedAt to createdAt when lastTimestamp is null', async () => {
      const mockResponse = {
        sessions: [
          {
            sessionId: 'session-3',
            title: 'Test',
            createdAt: '2026-02-01T09:00:00Z',
            lastTimestamp: null,
            messageCount: 5,
            isSidechain: false,
          },
        ],
      };

      mockBridge.request.mockResolvedValueOnce(mockResponse);

      const result = await api.index();

      expect(result[0].updatedAt).toEqual(new Date('2026-02-01T09:00:00Z'));
    });
  });

  describe('load()', () => {
    it('should send LOAD_SESSION request', async () => {
      mockBridge.request.mockResolvedValueOnce(undefined);

      await api.load('session-1');

      expect(mockBridge.request).toHaveBeenCalledWith('LOAD_SESSION', {
        sessionId: 'session-1',
        workingDir: '/test/path',
      });
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
    it('should send CREATE_SESSION request', async () => {
      mockBridge.request.mockResolvedValueOnce(undefined);

      await api.create();

      expect(mockBridge.request).toHaveBeenCalledWith('CREATE_SESSION', {});
    });
  });

  describe('destroy()', () => {
    it('should send DELETE_SESSION request with workingDir from config', async () => {
      mockBridge.request.mockResolvedValueOnce(undefined);

      await api.destroy('session-1');

      expect(mockBridge.request).toHaveBeenCalledWith('DELETE_SESSION', {
        sessionId: 'session-1',
        workingDir: '/test/path',
      });
    });

    it('should use explicit workingDir when provided', async () => {
      mockBridge.request.mockResolvedValueOnce(undefined);

      await api.destroy('session-2', '/explicit/path');

      expect(mockBridge.request).toHaveBeenCalledWith('DELETE_SESSION', {
        sessionId: 'session-2',
        workingDir: '/explicit/path',
      });
    });
  });

});
