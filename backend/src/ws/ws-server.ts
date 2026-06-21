import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { readFile } from 'fs/promises';
import { join, extname, resolve, sep } from 'path';
import { WebSocketServer, type WebSocket } from 'ws';
import { ConnectionManager } from './connection-manager';
import { handleEditorContextRequest } from './editor-context-route';
import type { Bridge } from '../bridge/bridge-interface';
import type { IPCMessage } from '../core/types';
import { ClientEnv } from '../shared';
import { getPluginVersion } from '../core/handlers/getVersion';
import { cancelLogin } from '../core/handlers/login';
import { reportBackendError } from '../core/features/telemetry';
import { LogWebSocketServer } from '../logging/log-ws';

const ALLOWED_WS_ORIGINS = new Set([
  'http://localhost',
  'http://127.0.0.1',
  'https://localhost',
  'https://127.0.0.1',
]);

const ALLOWED_TUNNEL_SUFFIXES = [
  '.trycloudflare.com',
];

/** Origins that are implicitly safe (no origin header, or JCEF file:// loads) */
function isImplicitlyAllowedOrigin(origin: string | undefined): boolean {
  // No Origin header — e.g. same-origin requests, non-browser clients
  if (!origin) return true;
  // JCEF may set origin to the literal string "null" (file:// or data: origins)
  if (origin === 'null') return true;
  // file:// protocol — JCEF local page loads
  if (origin.startsWith('file://')) return true;
  return false;
}

/** Origin 검증 — /ws, /logs 공통 */
function validateOrigin(origin: string | undefined): boolean {
  if (isImplicitlyAllowedOrigin(origin)) return true;
  try {
    const url = new URL(origin!);
    const normalized = `${url.protocol}//${url.hostname}`;
    if (ALLOWED_WS_ORIGINS.has(normalized)) return true;
    return ALLOWED_TUNNEL_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

export type BridgeMap = Record<ClientEnv, Bridge>;

export type MessageHandler = (
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
) => Promise<void> | void;

interface WebSocketServerHandle {
  connections: ConnectionManager;
  close: () => void;
  port: number;
  logWs?: LogWebSocketServer;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
};

/** Collect a request body into a string, capped to guard against unbounded input. */
const MAX_REQUEST_BODY_BYTES = 64 * 1024;

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_REQUEST_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function serveStaticFile(
  webviewDir: string,
  urlPath: string,
  res: ServerResponse,
): Promise<void> {
  // Strip querystring and hash before resolving the file path
  const cleanUrl = (urlPath ?? '/').split('?')[0].split('#')[0];
  const normalized = cleanUrl === '/' || !cleanUrl ? 'index.html' : cleanUrl.replace(/^\//, '');
  const filePath = resolve(webviewDir, normalized);

  // Prevent path traversal — resolved path must stay within webviewDir
  const resolvedWebviewDir = resolve(webviewDir);
  if (!filePath.startsWith(resolvedWebviewDir + sep) && filePath !== resolvedWebviewDir) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Hashed bundle assets are content-addressed and safe to cache forever.
  // Anything else (index.html, SPA fallback) must revalidate so a plugin update
  // never leaves JCEF pinned to a stale bundle.
  const isHashedAsset = normalized.startsWith('assets/');
  const cacheControl = isHashedAsset
    ? 'public, max-age=31536000, immutable'
    : 'no-cache, must-revalidate';

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
    });
    res.end(data);
  } catch {
    // Only fall back to index.html for SPA navigation routes (no file extension)
    const ext = extname(normalized).toLowerCase();
    if (ext && ext !== '.html') {
      // Static asset not found → 404 (never serve index.html as JS/CSS)
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    // SPA route fallback
    try {
      const indexData = await readFile(join(webviewDir, 'index.html'));
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
      });
      res.end(indexData);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
}

export function startWebSocketServer(
  port: number,
  bridges: BridgeMap,
  handleMessage: MessageHandler,
  webviewDir?: string,
  logWs?: LogWebSocketServer,
): Promise<WebSocketServerHandle> {
  return new Promise<WebSocketServerHandle>((resolve, reject) => {
    const connections = new ConnectionManager();

    // wss와 connections는 한 번만 생성
    const wss = new WebSocketServer({ noServer: true });
    const rpcWss = new WebSocketServer({ noServer: true });

    // WebSocket 연결 핸들러 — 한 번만 등록
    wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      // Parse client environment + optional panelId from query: /ws?env=jetbrains&panelId=...
      const params = new URL(request.url ?? '/ws', 'http://localhost').searchParams;
      const envParam = params.get('env');
      const clientEnv = envParam === ClientEnv.JETBRAINS ? ClientEnv.JETBRAINS : ClientEnv.BROWSER;
      const panelId = params.get('panelId');

      const connectionId = connections.addConnection(ws, clientEnv, panelId);
      console.error('[node-backend]', `Client connected: ${connectionId}`);

      // 연결 준비 신호 전송
      connections.sendTo(connectionId, 'BRIDGE_READY');

      ws.on('message', (data: Buffer) => {
        let parsed: IPCMessage;
        try {
          parsed = JSON.parse(data.toString()) as IPCMessage;
        } catch {
          console.error('[node-backend]', 'Failed to parse incoming message:', data.toString());
          return;
        }
        const bridge = bridges[connections.getClientEnv(connectionId)];
        // Single backend error boundary for the handler layer: any handler that throws
        // (or rejects) flows here, and reportBackendError is the ONLY place that reports it.
        // Individual handlers must NOT call trackError themselves — they rethrow to here.
        Promise.resolve(handleMessage(connectionId, parsed, connections, bridge)).catch((err) => {
          console.error('[node-backend]', `Unhandled error in handleMessage (${parsed.type}):`, err);
          reportBackendError(err instanceof Error ? err : new Error(String(err)), {
            layer: 'handler',
            messageType: parsed.type,
          });
        });
      });

      ws.on('close', () => {
        console.error('[node-backend]', `Client disconnected: ${connectionId}`);
        // An interactive `claude auth login` waiting on stdin won't exit on its
        // own once the webview is gone — kill it so it can't linger as a zombie.
        cancelLogin(connectionId);
        connections.removeConnection(connectionId);
      });
    });

    const httpServer: Server = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        const urlPath = (req.url ?? '/').split('?')[0];

        if (urlPath === '/version') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ version: getPluginVersion() }));
          return;
        }

        // IDE → backend editor selection push. Kotlin POSTs the active editor
        // selection here (loopback only); we route it to the webview as
        // EDITOR_CONTEXT, buffering it if no webview is connected yet.
        if (req.method === 'POST' && urlPath === '/internal/editor-context') {
          let rawBody: string;
          try {
            rawBody = await readRequestBody(req);
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to read request body' }));
            return;
          }
          const result = handleEditorContextRequest(connections, rawBody);
          res.writeHead(result.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result.body));
          return;
        }

        if (webviewDir) {
          await serveStaticFile(webviewDir, req.url ?? '/', res);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      },
    );

    // /ws, /logs 경로 WebSocket 업그레이드 (Origin 검증 공통 적용)
    httpServer.on('upgrade', (request, socket, head) => {
      const url = request.url;

      // Origin 검증 — /ws, /logs 공통
      const origin = request.headers.origin;
      if (!validateOrigin(origin)) {
        console.error('[node-backend]', `WebSocket connection rejected: disallowed origin "${origin}"`);
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      const urlPath = (url ?? '').split('?')[0];

      if (urlPath === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          wss.emit('connection', ws, request);
        });
      } else if (urlPath === '/rpc') {
        rpcWss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          const jetbrainsBridge = bridges[ClientEnv.JETBRAINS];
          if ('addRpcClient' in jetbrainsBridge && typeof (jetbrainsBridge as any).addRpcClient === 'function') {
            (jetbrainsBridge as any).addRpcClient(ws);
          }
        });
      } else if (url === '/logs' && logWs) {
        logWs.handleUpgrade(request, socket, head);
      } else {
        socket.destroy();
      }
    });

    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      reject(err);
    });

    httpServer.listen(port, '127.0.0.1', () => {
      const addr = httpServer.address();
      const assignedPort = typeof addr === 'object' && addr !== null ? addr.port : port;
      console.error('[node-backend]', `WebSocket server listening on port ${assignedPort}`);

      resolve({
        connections,
        port: assignedPort,
        logWs,
        close: () => {
          logWs?.close();
          rpcWss.close();
          wss.close();
          httpServer.close();
        },
      });
    });
  });
}
