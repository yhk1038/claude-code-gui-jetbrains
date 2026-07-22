import type { WebSocket } from 'ws';
import type { ChildProcess } from 'child_process';
import type { IPCMessage, NativeDropEntry } from '../core/types';
import { ClientEnv, MessageType } from '../shared';

const SESSION_CLEANUP_GRACE_MS = 30_000;
const IDLE_SHUTDOWN_GRACE_MS = 60_000;
/**
 * How long an editor-context payload stays valid while waiting for a webview to
 * connect. The "Add to Claude" action can fire before the JCEF panel has opened
 * its /ws socket (cold start); we stash the payload and replay it to the first
 * connection that arrives, but only within this window so a stale selection from
 * minutes ago is never injected.
 */
const PENDING_EDITOR_CONTEXT_TTL_MS = 10_000;

/** Push message type carrying the IDE editor selection to the webview. */
export const EDITOR_CONTEXT_MESSAGE = MessageType.EDITOR_CONTEXT;

/**
 * Push message type carrying the auto-tracked IDE selection to the webview.
 * Mirrors EDITOR_CONTEXT_MESSAGE but for the passive selection channel. Defined
 * here (not in ide-selection-route) so addConnection can replay the last
 * selection on connect — symmetric with how editor-context replays here.
 */
export const IDE_SELECTION_MESSAGE = MessageType.IDE_SELECTION;

interface PendingEditorContext {
  payload: Record<string, unknown>;
  expiresAt: number;
}

interface SessionRecord {
  sessionId: string;
  process: ChildProcess | null;
  subscribers: Set<string>;
  buffer: string;
  workingDir: string;
}

interface ClientRecord {
  subscribedSessionId: string | null;
  env: ClientEnv;
  /**
   * IDE panel that owns this webview connection (JetBrains mode only). Set from the
   * `panelId` query param that Kotlin embeds in the JCEF URL. Used to route panel-
   * scoped notifications (e.g. NATIVE_DROP) to the exact webview the user is looking
   * at, independent of sessionId which the webview generates itself.
   */
  panelId: string | null;
  /**
   * Native drop paths stashed by CefDragHandler.onDragEnter, waiting for the page-level
   * drop event to flush them. JCEF doesn't expose absolute paths on `dataTransfer` for
   * security reasons, so we receive the paths over the /rpc socket on drag-enter, hold
   * them here, and release them on NATIVE_DROP_FLUSH (which the webview fires from its
   * own `drop` handler). Cleared on flush and on disconnect.
   */
  nativeDropStash: NativeDropEntry[] | null;
}

export class ConnectionManager {
  private connectionMap = new Map<string, WebSocket>();
  private clientMap = new Map<string, ClientRecord>();
  private sessionRegistry = new Map<string, SessionRecord>();
  private cleanupTimers = new Map<string, NodeJS.Timeout>();
  private idleShutdownTimer: NodeJS.Timeout | null = null;
  // Secondary index for O(1) panelId → connectionId resolution. Panel ↔ connection
  // is 1:1 (one JCEF browser per IDE panel, one /ws socket per browser), so this
  // map is always in sync with the panelId stored on each ClientRecord.
  private panelIdIndex = new Map<string, string>();
  // Editor context awaiting a webview connection. Replayed to the first
  // connection that arrives within PENDING_EDITOR_CONTEXT_TTL_MS, then cleared.
  private pendingEditorContext: PendingEditorContext | null = null;
  // Last auto-tracked IDE selection. Unlike pendingEditorContext (a one-shot
  // "Add to Claude" action consumed by the first connection), this is a
  // persistent mirror of the currently-focused editor: it is peeked (not
  // consumed) and replayed to EVERY new connection so a reopened tool window /
  // reloaded webview restores the file context chip immediately, without the
  // user re-focusing the file. No TTL — kept until superseded by the next
  // selection, so restoration works no matter how long the panel was closed.
  private lastIdeSelection: Record<string, unknown> | null = null;
  // Panel (JCEF tab) whose webview most recently reported window focus via
  // PANEL_FOCUSED. Panel-scoped pushes (editor-context / ide-selection) are
  // routed to this panel's connection so only the panel the user is actually
  // looking at shows the file chip — instead of every open Claude panel sharing
  // the same workingDir. Keyed by the stable panelId, so it is session-agnostic
  // and covers uninitialized-session tabs. Like lastIdeSelection it has no TTL
  // (kept until the next PANEL_FOCUSED supersedes it), but is additionally
  // cleared in removeConnection when the focused panel's connection dies so
  // routeToFocusedOrBroadcast never targets a stale pointer.
  private lastFocusedPanelId: string | null = null;
  private nextId = 0;

  // ─── Connection lifecycle ───────────────────────────────────────────────────

  addConnection(ws: WebSocket, env: ClientEnv = ClientEnv.BROWSER, panelId: string | null = null): string {
    const connectionId = `conn-${++this.nextId}-${Date.now()}`;
    this.connectionMap.set(connectionId, ws);
    this.clientMap.set(connectionId, { subscribedSessionId: null, env, panelId, nativeDropStash: null });
    if (panelId) this.panelIdIndex.set(panelId, connectionId);
    this.cancelIdleShutdown();
    console.error(
      '[node-backend]',
      `Connection added: ${connectionId} (env: ${env}, panelId: ${panelId ?? 'none'})`,
    );

    // Replay any editor context that arrived before this webview connected
    // (e.g. "Add to Claude" fired during JCEF cold start).
    const pendingEditorContext = this.consumePendingEditorContext();
    if (pendingEditorContext) {
      this.sendTo(connectionId, EDITOR_CONTEXT_MESSAGE, pendingEditorContext);
    }

    // Replay the last IDE selection so a reopened tool window / reloaded webview
    // restores the current file context chip immediately, without the user
    // re-focusing the file. Peeked (not consumed) so every reconnection is
    // restored — this is the persistent counterpart to the one-shot replay above.
    const lastIdeSelection = this.getLastIdeSelection();
    if (lastIdeSelection) {
      this.sendTo(connectionId, IDE_SELECTION_MESSAGE, lastIdeSelection);
    }

    return connectionId;
  }

  // ─── Editor context buffer ──────────────────────────────────────────────────

  /**
   * Stash an editor-context payload to replay to the next webview connection.
   * Overwrites any earlier pending payload — only the latest selection matters.
   */
  setPendingEditorContext(payload: Record<string, unknown>): void {
    this.pendingEditorContext = {
      payload,
      expiresAt: Date.now() + PENDING_EDITOR_CONTEXT_TTL_MS,
    };
  }

  /**
   * Return the stashed editor-context payload and clear the buffer. Returns null
   * if nothing is stashed or the stash has expired (also clears in that case).
   */
  consumePendingEditorContext(): Record<string, unknown> | null {
    const pending = this.pendingEditorContext;
    this.pendingEditorContext = null;
    if (!pending) return null;
    if (Date.now() > pending.expiresAt) return null;
    return pending.payload;
  }

  // ─── Last IDE selection buffer ──────────────────────────────────────────────

  /**
   * Store the latest auto-tracked IDE selection to replay to future webview
   * connections. Overwrites any earlier value — only the current selection
   * matters. Unlike setPendingEditorContext this has no TTL and is not consumed
   * on replay: it mirrors the currently-focused editor for as long as the panel
   * stays on that file.
   */
  setLastIdeSelection(payload: Record<string, unknown>): void {
    this.lastIdeSelection = payload;
  }

  /**
   * Return the stored last IDE selection without clearing it (peek). Returns
   * null if no selection has been stored yet. Kept intact so every subsequent
   * connection (e.g. repeated tool-window reopens) is restored.
   */
  getLastIdeSelection(): Record<string, unknown> | null {
    return this.lastIdeSelection;
  }

  // ─── Last focused panel ─────────────────────────────────────────────────────

  /**
   * Record the panelId of the IDE tab whose webview most recently gained window
   * focus (reported via PANEL_FOCUSED). Overwrites any earlier value — only the
   * currently-focused panel matters. No TTL, mirroring setLastIdeSelection: kept
   * until the next focus event supersedes it (or the panel's connection is
   * removed). Used by routeToFocusedOrBroadcast to target panel-scoped pushes.
   */
  setLastFocusedPanelId(panelId: string): void {
    this.lastFocusedPanelId = panelId;
  }

  /**
   * Return the last-focused panelId, or null if no panel has reported focus yet
   * (or the focused panel's connection was since removed).
   */
  getLastFocusedPanelId(): string | null {
    return this.lastFocusedPanelId;
  }

  /**
   * Route a panel-scoped push (editor-context / ide-selection) to the LAST-FOCUSED
   * panel's webview when that panel still has a live connection; otherwise fall
   * back to broadcasting to every connection. The fallback preserves the pre-focus
   * behavior and is the safe default whenever no panel focus is known yet (cold
   * start) or the focused panel's webview has since disconnected — so a payload is
   * never silently dropped. Keyed by panelId, so it is session-agnostic.
   */
  routeToFocusedOrBroadcast(type: string, payload: Record<string, unknown> = {}): void {
    const panelId = this.lastFocusedPanelId;
    if (panelId) {
      const connectionId = this.panelIdIndex.get(panelId);
      if (connectionId && this.connectionMap.has(connectionId)) {
        this.sendTo(connectionId, type, payload);
        return;
      }
    }
    this.broadcastToAll(type, payload);
  }

  setNativeDropStash(panelId: string, entries: NativeDropEntry[]): boolean {
    const connectionId = this.panelIdIndex.get(panelId);
    if (!connectionId) return false;
    const record = this.clientMap.get(connectionId);
    if (!record) return false;
    record.nativeDropStash = entries;
    return true;
  }

  takeNativeDropStash(connectionId: string): NativeDropEntry[] | null {
    const record = this.clientMap.get(connectionId);
    if (!record || !record.nativeDropStash) return null;
    const stash = record.nativeDropStash;
    record.nativeDropStash = null;
    return stash;
  }

  /**
   * Resolve a panelId (assigned by Kotlin on JCEF browser creation) back to its
   * webview connection. Panel ↔ connection is 1:1 since each panel hosts one
   * JCEF browser that opens one /ws socket.
   */
  getConnectionIdByPanelId(panelId: string): string | null {
    return this.panelIdIndex.get(panelId) ?? null;
  }

  removeConnection(connectionId: string): void {
    this.unsubscribe(connectionId);
    const record = this.clientMap.get(connectionId);
    if (record?.panelId) {
      this.panelIdIndex.delete(record.panelId);
      // Drop the focus pointer if the panel losing its connection was the
      // last-focused one, so routeToFocusedOrBroadcast falls back to broadcast
      // rather than resolving to a dead connection.
      if (record.panelId === this.lastFocusedPanelId) {
        this.lastFocusedPanelId = null;
      }
    }
    this.connectionMap.delete(connectionId);
    this.clientMap.delete(connectionId);
    console.error('[node-backend]', `Connection removed: ${connectionId}`);

    if (this.connectionMap.size === 0) {
      this.scheduleIdleShutdown();
    }
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

    // Cancel pending cleanup if reconnecting within grace period
    const pendingTimer = this.cleanupTimers.get(sessionId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.cleanupTimers.delete(sessionId);
      console.error(
        '[node-backend]',
        `Cancelled cleanup timer for session ${sessionId} (subscriber reconnected)`,
      );
    }

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
        console.error(
          '[node-backend]',
          `Session ${sessionId} has no subscribers, scheduling cleanup in ${SESSION_CLEANUP_GRACE_MS}ms`,
        );
        const timer = setTimeout(() => {
          this.cleanupTimers.delete(sessionId);
          const currentSession = this.sessionRegistry.get(sessionId);
          if (currentSession && currentSession.subscribers.size === 0) {
            this.cleanupSession(sessionId);
          }
        }, SESSION_CLEANUP_GRACE_MS);
        this.cleanupTimers.set(sessionId, timer);
      }
    }

    client.subscribedSessionId = null;
  }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  getConnectionCount(): number {
    return this.connectionMap.size;
  }

  getClient(connectionId: string): ClientRecord | undefined {
    return this.clientMap.get(connectionId);
  }

  getClientEnv(connectionId: string): ClientEnv {
    return this.clientMap.get(connectionId)?.env ?? ClientEnv.BROWSER;
  }

  getSession(sessionId: string): SessionRecord | undefined {
    return this.sessionRegistry.get(sessionId);
  }

  getOrCreateSession(sessionId: string, workingDir?: string): SessionRecord {
    let session = this.sessionRegistry.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        process: null,
        subscribers: new Set(),
        buffer: '',
        workingDir: workingDir ?? '',
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
    // Clear all pending cleanup timers
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();

    this.cancelIdleShutdown();

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
    this.clientMap.clear();
    this.panelIdIndex.clear();
    this.lastFocusedPanelId = null;

    console.error(
      '[node-backend]',
      `Shutdown: killed ${killedSessions} session(s), closed ${closedConnections} connection(s)`,
    );
  }

  private scheduleIdleShutdown(): void {
    if (this.idleShutdownTimer !== null) return;

    console.error(
      '[node-backend]',
      `No active connections. Idle shutdown scheduled in ${IDLE_SHUTDOWN_GRACE_MS}ms`,
    );
    this.idleShutdownTimer = setTimeout(() => {
      console.error('[node-backend]', 'Idle shutdown grace period elapsed. Shutting down.');
      this.shutdownAll();
      process.exit(0);
    }, IDLE_SHUTDOWN_GRACE_MS);
  }

  private cancelIdleShutdown(): void {
    if (this.idleShutdownTimer === null) return;

    clearTimeout(this.idleShutdownTimer);
    this.idleShutdownTimer = null;
    console.error('[node-backend]', 'Idle shutdown timer cancelled (new connection received)');
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
