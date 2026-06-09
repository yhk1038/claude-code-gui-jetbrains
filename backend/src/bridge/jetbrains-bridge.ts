import type { Bridge } from './bridge-interface';
import type { WebSocket } from 'ws';
import { extractRoutingPath, selectRpcClientIndex } from './rpc-routing';

/**
 * Notification (IDE → backend) by which each IDE host advertises the project
 * roots it serves, so cross-IDE requests can be routed to the right client.
 */
const REGISTER_PROJECT_ROOTS = 'REGISTER_PROJECT_ROOTS';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
}

export type NotificationHandler = (method: string, params: Record<string, unknown>) => void;

interface PendingRequest {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Bridge that communicates with IDE hosts via WebSocket JSON-RPC.
 *
 * IDE connects to /rpc WebSocket endpoint; this bridge sends JSON-RPC requests
 * to connected IDE clients and receives responses.
 *
 * Unlike the old stdio-based approach, WebSocket allows reconnection —
 * if the IDE restarts, it can reconnect to the already-running backend.
 */
export class JetBrainsBridge implements Bridge {
  private idCounter = 0;
  private pendingRequests = new Map<string, PendingRequest>();
  private rpcClients = new Set<WebSocket>();
  // Project roots each IDE client serves, used to route cross-IDE requests.
  // An entry is added on REGISTER_PROJECT_ROOTS and removed when the socket closes.
  private clientRoots = new Map<WebSocket, string[]>();
  private notificationHandlers = new Map<string, NotificationHandler>();

  onNotification(method: string, handler: NotificationHandler): void {
    this.notificationHandlers.set(method, handler);
  }

  addRpcClient(ws: WebSocket): void {
    this.rpcClients.add(ws);
    console.error('[node-backend]', 'RPC client connected');

    ws.on('message', (data: Buffer) => {
      const trimmed = data.toString().trim();
      if (!trimmed) return;

      let parsed: JsonRpcResponse | JsonRpcNotification;
      try {
        parsed = JSON.parse(trimmed) as JsonRpcResponse | JsonRpcNotification;
      } catch {
        console.error('[node-backend]', 'Failed to parse JSON-RPC message:', trimmed);
        return;
      }

      // Notification (Kotlin → Node, no id): dispatch to registered handler.
      if (!('id' in parsed) || !parsed.id) {
        const notification = parsed as JsonRpcNotification;
        // Built-in: an IDE advertising the project roots it serves. Handled here
        // (not via notificationHandlers) because it is bound to *this* socket.
        if (notification.method === REGISTER_PROJECT_ROOTS) {
          this.clientRoots.set(ws, parseProjectRoots(notification.params));
          return;
        }
        const handler = this.notificationHandlers.get(notification.method);
        if (handler) {
          handler(notification.method, notification.params ?? {});
        } else {
          console.error('[node-backend]', `No handler for JSON-RPC notification: ${notification.method}`);
        }
        return;
      }

      // Response to one of our outgoing requests.
      const response = parsed as JsonRpcResponse;
      const pending = this.pendingRequests.get(response.id);
      if (!pending) return;

      clearTimeout(pending.timer);
      this.pendingRequests.delete(response.id);

      if (response.error) {
        pending.reject(new Error(`JSON-RPC error ${response.error.code}: ${response.error.message}`));
      } else {
        pending.resolve(response.result ?? {});
      }
    });

    ws.on('close', () => {
      this.rpcClients.delete(ws);
      this.clientRoots.delete(ws);
      console.error('[node-backend]', 'RPC client disconnected');
    });
  }

  /**
   * Pick the RPC client for an outgoing request. When several IDE hosts share
   * this backend, [routingPath] (a file path or workingDir) selects the client
   * whose registered project root best matches. Falls back to the first open
   * client when there is no path or no match — preserving single-IDE behaviour.
   */
  private getRpcClient(routingPath?: string): WebSocket | null {
    const clients = [...this.rpcClients];
    const idx = selectRpcClientIndex(
      clients.map((ws) => ({ roots: this.clientRoots.get(ws) ?? [], isOpen: ws.readyState === 1 })),
      routingPath,
    );
    return idx >= 0 ? clients[idx] : null;
  }

  private request(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const client = this.getRpcClient(extractRoutingPath(params));
      console.error('[node-backend]', `[DEBUG:bridge.request] method=${method}, rpcClients.size=${this.rpcClients.size}, client=${client ? `readyState=${client.readyState}` : 'null'}`);
      if (!client) {
        reject(new Error(`No RPC client connected — cannot send JSON-RPC request "${method}"`));
        return;
      }

      const id = `rpc-${++this.idCounter}`;

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`JSON-RPC request ${method} (id=${id}) timed out after ${REQUEST_TIMEOUT_MS}ms`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      console.error('[node-backend]', `[DEBUG:bridge.request] sending: ${JSON.stringify(request)}`);
      client.send(JSON.stringify(request) + '\n');
    });
  }

  async openFile(path: string): Promise<void> {
    await this.request('OPEN_FILE', { path });
  }

  async openDiff(params: {
    filePath: string;
    oldContent: string;
    newContent: string;
    toolUseId?: string;
  }): Promise<void> {
    await this.request('OPEN_DIFF', params);
  }

  async applyDiff(params: {
    filePath: string;
    newContent: string;
    toolUseId?: string;
  }): Promise<{ applied: boolean }> {
    const result = await this.request('APPLY_DIFF', params);
    return { applied: result['applied'] === true };
  }

  async rejectDiff(params: { toolUseId?: string }): Promise<void> {
    await this.request('REJECT_DIFF', params ?? {});
  }

  async refreshFiles(params: { paths: string[] }): Promise<void> {
    await this.request('REFRESH_FILES', { paths: params.paths });
  }

  async createSession(workingDir?: string): Promise<void> {
    await this.request('CREATE_SESSION', workingDir ? { workingDir } : {});
  }

  async openNewTab(workingDir?: string): Promise<void> {
    await this.request('OPEN_NEW_TAB', workingDir ? { workingDir } : {});
  }

  async openSettings(workingDir?: string): Promise<void> {
    await this.request('OPEN_SETTINGS', workingDir ? { workingDir } : {});
  }

  async openTerminal(workingDir: string): Promise<void> {
    await this.request('OPEN_TERMINAL', { workingDir });
  }

  async openUrl(url: string): Promise<void> {
    await this.request('OPEN_URL', { url });
  }

  async pickFiles(options: {
    mode: 'files' | 'folders' | 'both';
    multiple?: boolean;
  }): Promise<{ paths: string[] }> {
    const result = await this.request('PICK_FILES', options as unknown as Record<string, unknown>);
    const paths = result['paths'];
    return { paths: Array.isArray(paths) ? (paths as string[]) : [] };
  }

  async updatePlugin(): Promise<void> {
    await this.request('UPDATE_PLUGIN', {});
  }

  async requiresRestart(): Promise<boolean> {
    const result = await this.request('REQUIRES_RESTART', {});
    return result['requiresRestart'] === true;
  }

  async getIdeRoot(workingDir?: string): Promise<string | null> {
    const result = await this.request('GET_IDE_ROOT', workingDir ? { workingDir } : {});
    const ideRoot = result['ideRoot'];
    return typeof ideRoot === 'string' && ideRoot.length > 0 ? ideRoot : null;
  }
}

/**
 * Extract the `roots` string array from a REGISTER_PROJECT_ROOTS notification's
 * params, dropping any non-string entries. Returns [] when absent or malformed.
 */
export function parseProjectRoots(params: Record<string, unknown> | undefined): string[] {
  const roots = params?.['roots'];
  if (!Array.isArray(roots)) return [];
  return roots.filter((r): r is string => typeof r === 'string' && r.length > 0);
}
