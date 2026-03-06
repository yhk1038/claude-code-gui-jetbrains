import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { WebSocketServer, type WebSocket } from 'ws';
import { ConnectionManager } from './connection-manager';
import type { Bridge } from '../bridge/bridge-interface';
import type { IPCMessage } from '../core/types';

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
  const filePath = join(webviewDir, normalized);

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
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
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
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

    // wss와 connections는 한 번만 생성 — httpServer만 retry마다 재생성
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
        handleMessage(connectionId, parsed, connections, bridge);
      });

      ws.on('close', () => {
        console.error('[node-backend]', `Client disconnected: ${connectionId}`);
        connections.removeConnection(connectionId);
      });
    });

    // 포트 충돌 시 자동 retry — 최대 10회, 이후 port=0 (OS 동적 할당) fallback
    const maxRetries = 10;
    let attempt = 0;

    function tryListen(currentPort: number) {
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

      // /ws 경로만 WebSocket으로 업그레이드
      httpServer.on('upgrade', (request, socket, head) => {
        if (request.url === '/ws') {
          wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
            wss.emit('connection', ws, request);
          });
        } else {
          socket.destroy();
        }
      });

      httpServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && attempt < maxRetries) {
          attempt++;
          // 최대 retry 횟수 초과 시 port=0으로 OS 동적 할당 fallback
          const nextPort = attempt < maxRetries ? port + attempt : 0;
          console.error(
            '[node-backend]',
            `Port ${currentPort} busy, trying ${nextPort === 0 ? 'dynamic' : nextPort}...`,
          );
          tryListen(nextPort);
        } else {
          reject(err);
        }
      });

      httpServer.listen(currentPort, '127.0.0.1', () => {
        const addr = httpServer.address();
        const assignedPort = typeof addr === 'object' && addr !== null ? addr.port : currentPort;
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
    }

    tryListen(port);
  });
}
