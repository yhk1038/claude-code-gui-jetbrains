import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionManager } from '../connection-manager';
import { ClientEnv } from '../../shared';
import { MessageType } from '../../shared';

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

  // Unlike the one-shot editor-context buffer above, the ide-selection buffer is
  // a persistent mirror of the currently-focused editor: it is peeked (not
  // consumed) and replayed to EVERY new connection so a reopened tool window /
  // reloaded webview restores the file context chip immediately.
  describe('last IDE selection buffer', () => {
    it('should return the stashed payload on get', () => {
      const payload = { absolutePath: '/abs/src/file.ts', relativePath: 'src/file.ts' };
      cm.setLastIdeSelection(payload);
      expect(cm.getLastIdeSelection()).toEqual(payload);
    });

    it('should NOT clear the buffer after get (peek, persists)', () => {
      const payload = { absolutePath: '/abs/a.ts', relativePath: 'a.ts' };
      cm.setLastIdeSelection(payload);
      cm.getLastIdeSelection();
      expect(cm.getLastIdeSelection()).toEqual(payload);
    });

    it('should return null when nothing was stashed', () => {
      expect(cm.getLastIdeSelection()).toBeNull();
    });

    it('should overwrite an earlier payload with the latest one', () => {
      cm.setLastIdeSelection({ absolutePath: '/abs/old.ts', relativePath: 'old.ts' });
      const latest = { absolutePath: '/abs/new.ts', relativePath: 'new.ts' };
      cm.setLastIdeSelection(latest);
      expect(cm.getLastIdeSelection()).toEqual(latest);
    });

    it('should replay a stashed payload to a newly added connection as IDE_SELECTION', () => {
      const payload = {
        absolutePath: '/abs/src/file.ts',
        relativePath: 'src/file.ts',
        startLine: 10,
        endLine: 25,
        selectedText: 'const x = 1;',
        workingDir: '/abs',
        isGitignored: false,
      };
      cm.setLastIdeSelection(payload);

      const ws = createMockWs();
      cm.addConnection(ws);

      expect(ws.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(sent.type).toBe(MessageType.IDE_SELECTION);
      expect(sent.payload).toEqual(payload);
    });

    it('should replay to EVERY new connection (not consumed on first replay)', () => {
      cm.setLastIdeSelection({ absolutePath: '/abs/a.ts', relativePath: 'a.ts' });

      const ws1 = createMockWs();
      cm.addConnection(ws1);
      const ws2 = createMockWs();
      cm.addConnection(ws2);

      expect(ws1.send).toHaveBeenCalledTimes(1);
      expect(ws2.send).toHaveBeenCalledTimes(1);
    });

    it('should not replay anything to a new connection when nothing was stashed', () => {
      const ws = createMockWs();
      cm.addConnection(ws);
      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  // The last-focused panel is the routing target for panel-scoped pushes
  // (editor-context / ide-selection). Keyed by the stable panelId reported via
  // PANEL_FOCUSED, it mirrors lastIdeSelection: no TTL, kept until superseded —
  // but additionally cleared when the focused panel's connection is removed so
  // routeToFocusedOrBroadcast never targets a dead connection.
  describe('last focused panel routing', () => {
    it('should round-trip setLastFocusedPanelId / getLastFocusedPanelId', () => {
      cm.setLastFocusedPanelId('panel-1');
      expect(cm.getLastFocusedPanelId()).toBe('panel-1');
    });

    it('should return null when no panel has reported focus yet', () => {
      expect(cm.getLastFocusedPanelId()).toBeNull();
    });

    it('should overwrite an earlier focused panel with the latest one', () => {
      cm.setLastFocusedPanelId('panel-1');
      cm.setLastFocusedPanelId('panel-2');
      expect(cm.getLastFocusedPanelId()).toBe('panel-2');
    });

    it('should clear lastFocusedPanelId when the focused panel connection is removed', () => {
      const ws = createMockWs();
      const connId = cm.addConnection(ws, ClientEnv.BROWSER, 'panel-1');
      cm.setLastFocusedPanelId('panel-1');

      cm.removeConnection(connId);

      expect(cm.getLastFocusedPanelId()).toBeNull();
    });

    it('should keep lastFocusedPanelId when a DIFFERENT panel connection is removed', () => {
      const wsFocused = createMockWs();
      cm.addConnection(wsFocused, ClientEnv.BROWSER, 'panel-1');
      const wsOther = createMockWs();
      const otherId = cm.addConnection(wsOther, ClientEnv.BROWSER, 'panel-2');
      cm.setLastFocusedPanelId('panel-1');

      cm.removeConnection(otherId);

      expect(cm.getLastFocusedPanelId()).toBe('panel-1');
    });

    it('should send ONLY to the focused panel connection when it is live', () => {
      const wsFocused = createMockWs();
      cm.addConnection(wsFocused, ClientEnv.BROWSER, 'panel-1');
      const wsOther = createMockWs();
      cm.addConnection(wsOther, ClientEnv.BROWSER, 'panel-2');
      cm.setLastFocusedPanelId('panel-1');

      cm.routeToFocusedOrBroadcast('TEST_EVENT', { data: 'hi' });

      expect(wsFocused.send).toHaveBeenCalledTimes(1);
      expect(wsOther.send).not.toHaveBeenCalled();
      const sent = JSON.parse((wsFocused.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(sent.type).toBe('TEST_EVENT');
      expect(sent.payload).toEqual({ data: 'hi' });
    });

    it('should fall back to broadcast when no panel focus is known', () => {
      const ws1 = createMockWs();
      cm.addConnection(ws1, ClientEnv.BROWSER, 'panel-1');
      const ws2 = createMockWs();
      cm.addConnection(ws2, ClientEnv.BROWSER, 'panel-2');
      // lastFocusedPanelId is null (cold start)

      cm.routeToFocusedOrBroadcast('TEST_EVENT', { data: 'hi' });

      expect(ws1.send).toHaveBeenCalledTimes(1);
      expect(ws2.send).toHaveBeenCalledTimes(1);
    });

    it('should fall back to broadcast when the focused panel has no live connection', () => {
      const ws1 = createMockWs();
      cm.addConnection(ws1, ClientEnv.BROWSER, 'panel-1');
      const ws2 = createMockWs();
      cm.addConnection(ws2, ClientEnv.BROWSER, 'panel-2');
      // Focus points at a panel that never opened a connection (e.g. stale id).
      cm.setLastFocusedPanelId('ghost-panel');

      cm.routeToFocusedOrBroadcast('TEST_EVENT', { data: 'hi' });

      expect(ws1.send).toHaveBeenCalledTimes(1);
      expect(ws2.send).toHaveBeenCalledTimes(1);
    });
  });
});
