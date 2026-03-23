import type { Bridge } from './bridge-interface';
import type { WebSocket } from 'ws';

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

  addRpcClient(ws: WebSocket): void {
    this.rpcClients.add(ws);
    console.error('[node-backend]', 'RPC client connected');

    ws.on('message', (data: Buffer) => {
      const trimmed = data.toString().trim();
      if (!trimmed) return;

      let response: JsonRpcResponse;
      try {
        response = JSON.parse(trimmed) as JsonRpcResponse;
      } catch {
        console.error('[node-backend]', 'Failed to parse JSON-RPC response:', trimmed);
        return;
      }

      if (!response.id) return;

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
      console.error('[node-backend]', 'RPC client disconnected');
    });
  }

  private getRpcClient(): WebSocket | null {
    for (const client of this.rpcClients) {
      if (client.readyState === 1) return client;
    }
    return null;
  }

  private request(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const client = this.getRpcClient();
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
}
