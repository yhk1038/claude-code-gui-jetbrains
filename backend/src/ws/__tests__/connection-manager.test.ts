import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionManager } from '../connection-manager';
import { ClientEnv } from '../../shared';

function createMockWs(readyState = 1) {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as import('ws').WebSocket;
}

describe('ConnectionManager', () => {
  let cm: ConnectionManager;

  beforeEach(() => {
    cm = new ConnectionManager();
    vi.useFakeTimers();
  });

  describe('subscribe / unsubscribe', () => {
    it('should subscribe connection to session', () => {
      const ws = createMockWs();
      const connId = cm.addConnection(ws);
      cm.subscribe(connId, 'sess-1');

      const client = cm.getClient(connId);
      expect(client?.subscribedSessionId).toBe('sess-1');
    });

    it('should unsubscribe from previous session when subscribing to new one', () => {
      const ws = createMockWs();
      const connId = cm.addConnection(ws);
      cm.subscribe(connId, 'sess-1');
      cm.subscribe(connId, 'sess-2');

      const client = cm.getClient(connId);
      expect(client?.subscribedSessionId).toBe('sess-2');
    });

    it('should be no-op when subscribing to same session', () => {
      const ws = createMockWs();
      const connId = cm.addConnection(ws);
      cm.subscribe(connId, 'sess-1');
      cm.subscribe(connId, 'sess-1'); // no-op
      expect(cm.getClient(connId)?.subscribedSessionId).toBe('sess-1');
    });

    it('should unsubscribe and set subscribedSessionId to null', () => {
      const ws = createMockWs();
      const connId = cm.addConnection(ws);
      cm.subscribe(connId, 'sess-1');
      cm.unsubscribe(connId);
      expect(cm.getClient(connId)?.subscribedSessionId).toBeNull();
    });
  });

  describe('broadcastToSession', () => {
    it('should send to all subscribers of a session', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const conn1 = cm.addConnection(ws1);
      const conn2 = cm.addConnection(ws2);
      cm.subscribe(conn1, 'sess-1');
      cm.subscribe(conn2, 'sess-1');

      cm.broadcastToSession('sess-1', 'TEST_EVENT', { data: 'hello' });

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it('should exclude specified connection', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const conn1 = cm.addConnection(ws1);
      const conn2 = cm.addConnection(ws2);
      cm.subscribe(conn1, 'sess-1');
      cm.subscribe(conn2, 'sess-1');

      cm.broadcastToSession('sess-1', 'TEST_EVENT', {}, conn1);

      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it('should be no-op for non-existent session', () => {
      cm.broadcastToSession('nonexistent', 'TEST_EVENT');
      // No exception
    });
  });

  describe('broadcastToAll', () => {
    it('should send to all connections', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      cm.addConnection(ws1);
      cm.addConnection(ws2);

      cm.broadcastToAll('GLOBAL_EVENT', { data: 'all' });

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalled();
    });

    it('should not send to closed connections', () => {
      const wsOpen = createMockWs(1);
      const wsClosed = createMockWs(3); // CLOSED
      cm.addConnection(wsOpen);
      cm.addConnection(wsClosed);

      cm.broadcastToAll('EVENT');

      expect(wsOpen.send).toHaveBeenCalled();
      expect(wsClosed.send).not.toHaveBeenCalled();
    });
  });

  describe('shutdownAll', () => {
    it('should kill all session processes and close all connections', () => {
      const ws = createMockWs();
      cm.addConnection(ws);
      const mockProcess = { kill: vi.fn() } as unknown as import('child_process').ChildProcess;
      cm.setProcess('sess-1', mockProcess);

      cm.shutdownAll();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(ws.close).toHaveBeenCalled();
    });
  });

  describe('session process management', () => {
    it('should set and get process for session', () => {
      const proc = { kill: vi.fn() } as unknown as import('child_process').ChildProcess;
      cm.getOrCreateSession('sess-1');
      cm.setProcess('sess-1', proc);
      expect(cm.getProcess('sess-1')).toBe(proc);
    });

    it('should return null for non-existent session process', () => {
      expect(cm.getProcess('nonexistent')).toBeNull();
    });
  });

  describe('buffer management', () => {
    it('should set and get buffer', () => {
      cm.getOrCreateSession('sess-1');
      cm.setBuffer('sess-1', 'partial data');
      expect(cm.getBuffer('sess-1')).toBe('partial data');
    });

    it('should return empty string for non-existent session buffer', () => {
      expect(cm.getBuffer('nonexistent')).toBe('');
    });
  });
});
