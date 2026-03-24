import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessagesApi } from '../MessagesApi';

function createMockBridge() {
  return {
    request: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(vi.fn()),
  } as unknown as import('../../bridge/BridgeClient').BridgeClient;
}

describe('MessagesApi', () => {
  let api: MessagesApi;
  let bridge: ReturnType<typeof createMockBridge>;

  beforeEach(() => {
    bridge = createMockBridge();
    api = new MessagesApi(bridge);
  });

  describe('create()', () => {
    it('should send SEND_MESSAGE with sessionId and content', async () => {
      await api.create('sess-1', 'Hello world');
      expect(bridge.request).toHaveBeenCalledWith('SEND_MESSAGE', {
        sessionId: 'sess-1',
        content: 'Hello world',
      });
    });

    it('should handle empty content', async () => {
      await api.create('sess-1', '');
      expect(bridge.request).toHaveBeenCalledWith('SEND_MESSAGE', {
        sessionId: 'sess-1',
        content: '',
      });
    });
  });

  describe('onError()', () => {
    it('should subscribe to SERVICE_ERROR events', () => {
      const callback = vi.fn();
      api.onError(callback);
      expect(bridge.subscribe).toHaveBeenCalledWith('SERVICE_ERROR', expect.any(Function));
    });

    it('should return unsubscribe function', () => {
      const unsubscribe = vi.fn();
      vi.mocked(bridge.subscribe).mockReturnValue(unsubscribe);

      const result = api.onError(vi.fn());
      expect(result).toBe(unsubscribe);
    });

    it('should transform payload into error object', () => {
      let capturedHandler: ((msg: { payload?: Record<string, unknown> }) => void) | undefined;
      vi.mocked(bridge.subscribe).mockImplementation((_type, handler) => {
        capturedHandler = handler as typeof capturedHandler;
        return vi.fn();
      });

      const callback = vi.fn();
      api.onError(callback);

      capturedHandler!({ payload: { type: 'CLI_ERROR', message: 'Something failed' } });

      expect(callback).toHaveBeenCalledWith({
        type: 'CLI_ERROR',
        message: 'Something failed',
      });
    });

    it('should use defaults when payload fields are missing', () => {
      let capturedHandler: ((msg: { payload?: Record<string, unknown> }) => void) | undefined;
      vi.mocked(bridge.subscribe).mockImplementation((_type, handler) => {
        capturedHandler = handler as typeof capturedHandler;
        return vi.fn();
      });

      const callback = vi.fn();
      api.onError(callback);

      capturedHandler!({ payload: {} });

      expect(callback).toHaveBeenCalledWith({
        type: 'unknown',
        message: 'Unknown error',
      });
    });
  });
});
