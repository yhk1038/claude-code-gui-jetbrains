import type { WebSocket } from 'ws';
import type { ChildProcess } from 'child_process';
import type { IPCMessage } from '../core/types';

interface SessionRecord {
  sessionId: string;
  process: ChildProcess | null;
  subscribers: Set<string>;
  buffer: string;
  workingDir: string;
}

interface ClientRecord {
  subscribedSessionId: string | null;
}

export class ConnectionManager {
  private connectionMap = new Map<string, WebSocket>();
  private clientMap = new Map<string, ClientRecord>();
  private sessionRegistry = new Map<string, SessionRecord>();
  private nextId = 0;

  // ─── Connection lifecycle ───────────────────────────────────────────────────

  addConnection(ws: WebSocket): string {
    const connectionId = `conn-${++this.nextId}-${Date.now()}`;
    this.connectionMap.set(connectionId, ws);
    this.clientMap.set(connectionId, { subscribedSessionId: null });
    console.error('[node-backend]', `Connection added: ${connectionId}`);
    return connectionId;
  }

  removeConnection(connectionId: string): void {
    this.unsubscribe(connectionId);
    this.connectionMap.delete(connectionId);
    this.clientMap.delete(connectionId);
    console.error('[node-backend]', `Connection removed: ${connectionId}`);
  }

  // ─── Messaging ──────────────────────────────────────────────────────────────

  sendTo(connectionId: string, type: string, payload: Record<string, unknown> = {}): void {
    const ws = this.connectionMap.get(connectionId);
    if (!ws) return;

    const message: IPCMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };

    try {
      if (ws.readyState === 1 /* WebSocket.OPEN */) {
        ws.send(JSON.stringify(message));
      }
    } catch {
      // send failure — will be cleaned up on disconnect
    }
  }

  broadcastToSession(
    sessionId: string,
    type: string,
    payload: Record<string, unknown> = {},
    excludeConnectionId?: string,
  ): void {
    const session = this.sessionRegistry.get(sessionId);
    if (!session) return;

    const message: IPCMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };
    const data = JSON.stringify(message);

    for (const connId of session.subscribers) {
      if (connId === excludeConnectionId) continue;
      const ws = this.connectionMap.get(connId);
      if (!ws) continue;

      try {
        if (ws.readyState === 1 /* WebSocket.OPEN */) {
          ws.send(data);
        }
      } catch {
        // send failure — will be cleaned up on disconnect
      }
    }
  }

  broadcastToAll(type: string, payload: Record<string, unknown> = {}): void {
    const message: IPCMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };
    const data = JSON.stringify(message);

    for (const [, ws] of this.connectionMap) {
      try {
        if (ws.readyState === 1 /* WebSocket.OPEN */) {
          ws.send(data);
        }
      } catch {
        // send failure — will be cleaned up on disconnect
      }
    }
  }

  // ─── Subscription (Pub/Sub) ─────────────────────────────────────────────────

  subscribe(connectionId: string, sessionId: string): void {
    const client = this.clientMap.get(connectionId);
    // Already subscribed to the same session — no-op
    if (client?.subscribedSessionId === sessionId) {
      return;
    }

    // Unsubscribe from any DIFFERENT session first
    this.unsubscribe(connectionId);

    const session = this.getOrCreateSession(sessionId);
    session.subscribers.add(connectionId);

    if (client) {
      client.subscribedSessionId = sessionId;
    }

    console.error(
      '[node-backend]',
      `${connectionId} subscribed to session ${sessionId} (subscribers: ${session.subscribers.size})`,
    );
  }

  unsubscribe(connectionId: string): void {
    const client = this.clientMap.get(connectionId);
    if (!client?.subscribedSessionId) return;

    const sessionId = client.subscribedSessionId;
    const session = this.sessionRegistry.get(sessionId);

    if (session) {
      session.subscribers.delete(connectionId);
      console.error(
        '[node-backend]',
        `${connectionId} unsubscribed from session ${sessionId} (subscribers: ${session.subscribers.size})`,
      );

      if (session.subscribers.size === 0) {
        this.cleanupSession(sessionId);
      }
    }

    client.subscribedSessionId = null;
  }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  getClient(connectionId: string): ClientRecord | undefined {
    return this.clientMap.get(connectionId);
  }

  getSession(sessionId: string): SessionRecord | undefined {
    return this.sessionRegistry.get(sessionId);
  }

  getOrCreateSession(sessionId: string): SessionRecord {
    let session = this.sessionRegistry.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        process: null,
        subscribers: new Set(),
        buffer: '',
        workingDir: process.cwd(),
      };
      this.sessionRegistry.set(sessionId, session);
    }
    return session;
  }

  // ─── Process accessors ─────────────────────────────────────────────────────

  setProcess(sessionId: string, proc: ChildProcess | null): void {
    const session = this.getOrCreateSession(sessionId);
    session.process = proc;
  }

  getProcess(sessionId: string): ChildProcess | null {
    return this.sessionRegistry.get(sessionId)?.process ?? null;
  }

  setBuffer(sessionId: string, buffer: string): void {
    const session = this.sessionRegistry.get(sessionId);
    if (session) {
      session.buffer = buffer;
    }
  }

  getBuffer(sessionId: string): string {
    return this.sessionRegistry.get(sessionId)?.buffer ?? '';
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  shutdownAll(): void {
    let killedSessions = 0;
    let closedConnections = 0;

    for (const session of this.sessionRegistry.values()) {
      if (session.process) {
        session.process.kill('SIGTERM');
        killedSessions++;
      }
    }

    for (const ws of this.connectionMap.values()) {
      ws.close();
      closedConnections++;
    }

    this.sessionRegistry.clear();
    this.connectionMap.clear();

    console.error(
      '[node-backend]',
      `Shutdown: killed ${killedSessions} session(s), closed ${closedConnections} connection(s)`,
    );
  }

  private cleanupSession(sessionId: string): void {
    const session = this.sessionRegistry.get(sessionId);
    if (!session) return;

    if (session.process) {
      console.error(
        '[node-backend]',
        `Killing process for session ${sessionId} (PID: ${session.process.pid})`,
      );
      session.process.kill('SIGTERM');
      session.process = null;
    }

    this.sessionRegistry.delete(sessionId);
    console.error('[node-backend]', `Session ${sessionId} cleaned up`);
  }
}
