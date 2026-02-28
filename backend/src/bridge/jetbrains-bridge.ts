import type { Readable, Writable } from 'stream';
import { createInterface } from 'readline';
import type { Bridge } from './bridge-interface';

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
 * Bridge that communicates with the Kotlin IDE host via stdio JSON-RPC.
 *
 * - Sends JSON-RPC requests to `outStream` (Node.js stdout -> Kotlin reads)
 * - Reads JSON-RPC responses from `inStream` (Kotlin writes -> Node.js stdin)
 */
export class JetBrainsBridge implements Bridge {
  private idCounter = 0;
  private pendingRequests = new Map<string, PendingRequest>();

  constructor(
    private outStream: Writable,
    private inStream: Readable,
  ) {
    this.listenForResponses();
  }

  private listenForResponses(): void {
    const rl = createInterface({ input: this.inStream });

    rl.on('line', (line: string) => {
      const trimmed = line.trim();
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
  }

  private request(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return new Promise<Record<string, unknown>>((resolve, reject) => {
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

      this.outStream.write(JSON.stringify(request) + '\n');
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

  async newSession(): Promise<void> {
    await this.request('NEW_SESSION');
  }

  async openSettings(): Promise<void> {
    await this.request('OPEN_SETTINGS');
  }
}
