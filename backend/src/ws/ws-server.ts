import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { readFile } from 'fs/promises';
import { join, extname, resolve } from 'path';
import { WebSocketServer, type WebSocket } from 'ws';
import { ConnectionManager } from './connection-manager';
import type { Bridge } from '../bridge/bridge-interface';
import type { IPCMessage } from '../core/types';

const ALLOWED_WS_ORIGINS = new Set([
  'http://localhost',
  'http://127.0.0.1',
  'https://localhost',
  'https://127.0.0.1',
]);

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
  if (!filePath.startsWith(resolvedWebviewDir + '/') && filePath !== resolvedWebviewDir) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
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
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
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
  bridge: Bridge,
  handleMessage: MessageHandler,
  webviewDir?: string,
): Promise<WebSocketServerHandle> {
  return new Promise<WebSocketServerHandle>((resolve, reject) => {
    const connections = new ConnectionManager();

    // wss와 connections는 한 번만 생성
    const wss = new WebSocketServer({ noServer: true });

    // WebSocket 연결 핸들러 — 한 번만 등록
    wss.on('connection', (ws: WebSocket) => {
      const connectionId = connections.addConnection(ws);
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
        Promise.resolve(handleMessage(connectionId, parsed, connections, bridge)).catch((err) => {
          console.error('[node-backend]', `Unhandled error in handleMessage (${parsed.type}):`, err);
        });
      });

      ws.on('close', () => {
        console.error('[node-backend]', `Client disconnected: ${connectionId}`);
        connections.removeConnection(connectionId);
      });
    });

    const httpServer: Server = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        if (webviewDir) {
          await serveStaticFile(webviewDir, req.url ?? '/', res);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      },
    );

    // /ws 경로만 WebSocket으로 업그레이드 (Origin 검증 포함)
    httpServer.on('upgrade', (request, socket, head) => {
      if (request.url !== '/ws') {
        socket.destroy();
        return;
      }

      // Origin 검증 — localhost만 허용
      const origin = request.headers.origin;
      if (origin) {
        try {
          const url = new URL(origin);
          const normalized = `${url.protocol}//${url.hostname}`;
          if (!ALLOWED_WS_ORIGINS.has(normalized)) {
            console.error('[node-backend]', `WebSocket connection rejected: disallowed origin "${origin}"`);
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            socket.destroy();
            return;
          }
        } catch {
          console.error('[node-backend]', `WebSocket connection rejected: malformed origin "${origin}"`);
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }
      }

      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit('connection', ws, request);
      });
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
        close: () => {
          wss.close();
          httpServer.close();
        },
      });
    });
  });
}
