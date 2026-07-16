import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionManager } from '../connection-manager';
import { ClientEnv } from '../../shared';
import { MessageType } from '../../shared';
import { Claude } from '../../core/claude';

// connection-manager delegates process kills to Claude.killTree (process-group
// kill). Mock it here: unit tests use fake PIDs, and a real group
// signal aimed at a fake PID could hit an unrelated live process group on the
// test machine. Real-process coverage lives in kill-tree.integration.test.ts.
vi.mock('../../core/claude', () => ({
  Claude: { killTree: vi.fn() },
}));

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
      const mockProcess = { pid: 4242, kill: vi.fn() } as unknown as import('child_process').ChildProcess;
      cm.setProcess('sess-1', mockProcess);

      cm.shutdownAll();

      expect(Claude.killTree).toHaveBeenCalledWith(mockProcess, 'SIGTERM');
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

  describe('getConnectionCount', () => {
    it('should return 0 when there are no connections', () => {
      expect(cm.getConnectionCount()).toBe(0);
    });

    it('should reflect the number of active connections', () => {
      cm.addConnection(createMockWs());
      cm.addConnection(createMockWs());
      expect(cm.getConnectionCount()).toBe(2);
    });

    it('should decrease when a connection is removed', () => {
      const connId = cm.addConnection(createMockWs());
      cm.addConnection(createMockWs());
      cm.removeConnection(connId);
      expect(cm.getConnectionCount()).toBe(1);
    });
  });

  describe('keep-alive gate (idle shutdown)', () => {
    const IDLE_GRACE = 60_000;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      exitSpy.mockClear();
    });

    afterEach(() => {
      exitSpy.mockRestore();
    });

    it('should idle-shutdown 60s after the last connection leaves (baseline)', () => {
      const connId = cm.addConnection(createMockWs());
      cm.removeConnection(connId);
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should not schedule idle shutdown while keep-alive is enabled', () => {
      cm.setKeepAlive(true);
      const connId = cm.addConnection(createMockWs());
      cm.removeConnection(connId);
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should cancel an already-armed timer when keep-alive is enabled', () => {
      const connId = cm.addConnection(createMockWs());
      cm.removeConnection(connId); // arms the timer
      cm.setKeepAlive(true);
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should arm the timer on a false push with zero connections (prewarm-leak fix)', () => {
      // Fresh manager, no /ws connection was ever added: removeConnection never
      // fires, so without this push the backend would linger forever.
      cm.setKeepAlive(false);
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should arm the timer when keep-alive is disabled at zero connections (keep-alive clamp)', () => {
      cm.setKeepAlive(true);
      cm.setKeepAlive(false);
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should not arm the timer when keep-alive is disabled with live connections', () => {
      cm.addConnection(createMockWs());
      cm.setKeepAlive(false);
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should cancel the setKeepAlive(false)-armed timer when a connection arrives', () => {
      cm.setKeepAlive(false); // arms (zero connections)
      cm.addConnection(createMockWs());
      vi.advanceTimersByTime(IDLE_GRACE + 1);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should report the gate state via isKeepAlive', () => {
      expect(cm.isKeepAlive()).toBe(false);
      cm.setKeepAlive(true);
      expect(cm.isKeepAlive()).toBe(true);
      cm.setKeepAlive(false);
      expect(cm.isKeepAlive()).toBe(false);
    });
  });

  describe('pending editor context buffer', () => {
    it('should return the stashed payload on consume', () => {
      const payload = { absolutePath: '/abs/src/file.ts', relativePath: 'src/file.ts' };
      cm.setPendingEditorContext(payload);
      expect(cm.consumePendingEditorContext()).toEqual(payload);
    });

    it('should clear the buffer after a single consume', () => {
      cm.setPendingEditorContext({ absolutePath: '/abs/a.ts', relativePath: 'a.ts' });
      cm.consumePendingEditorContext();
      expect(cm.consumePendingEditorContext()).toBeNull();
    });

    it('should return null when nothing was stashed', () => {
      expect(cm.consumePendingEditorContext()).toBeNull();
    });

    it('should return null and clear after the 10s expiry window', () => {
      cm.setPendingEditorContext({ absolutePath: '/abs/a.ts', relativePath: 'a.ts' });
      vi.advanceTimersByTime(10_000 + 1);
      expect(cm.consumePendingEditorContext()).toBeNull();
    });

    it('should still return the payload just before expiry', () => {
      const payload = { absolutePath: '/abs/a.ts', relativePath: 'a.ts' };
      cm.setPendingEditorContext(payload);
      vi.advanceTimersByTime(9_999);
      expect(cm.consumePendingEditorContext()).toEqual(payload);
    });

    it('should overwrite an earlier pending payload with the latest one', () => {
      cm.setPendingEditorContext({ absolutePath: '/abs/old.ts', relativePath: 'old.ts' });
      const latest = { absolutePath: '/abs/new.ts', relativePath: 'new.ts' };
      cm.setPendingEditorContext(latest);
      expect(cm.consumePendingEditorContext()).toEqual(latest);
    });

    it('should replay a stashed payload to a newly added connection as EDITOR_CONTEXT', () => {
      const payload = { absolutePath: '/abs/src/file.ts', relativePath: 'src/file.ts', startLine: 10, endLine: 25 };
      cm.setPendingEditorContext(payload);

      const ws = createMockWs();
      cm.addConnection(ws);

      expect(ws.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(sent.type).toBe(MessageType.EDITOR_CONTEXT);
      expect(sent.payload).toEqual(payload);
    });

    it('should consume the buffer on replay so the next connection gets nothing', () => {
      cm.setPendingEditorContext({ absolutePath: '/abs/a.ts', relativePath: 'a.ts' });
      cm.addConnection(createMockWs());

      const ws2 = createMockWs();
      cm.addConnection(ws2);
      expect(ws2.send).not.toHaveBeenCalled();
    });

    it('should not replay an expired buffer to a newly added connection', () => {
      cm.setPendingEditorContext({ absolutePath: '/abs/a.ts', relativePath: 'a.ts' });
      vi.advanceTimersByTime(10_000 + 1);

      const ws = createMockWs();
      cm.addConnection(ws);
      expect(ws.send).not.toHaveBeenCalled();
    });
  });
});
