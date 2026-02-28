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
  // Default to index.html for root and unknown paths (SPA)
  const normalized = urlPath === '/' || !urlPath ? 'index.html' : urlPath.replace(/^\//, '');
  const filePath = join(webviewDir, normalized);

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    // Fall back to index.html for SPA routing
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

    const wss = new WebSocketServer({ noServer: true });

    // Upgrade only /ws path to WebSocket
    httpServer.on('upgrade', (request, socket, head) => {
      if (request.url === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    // Handle new WebSocket connections
    wss.on('connection', (ws: WebSocket) => {
      const connectionId = connections.addConnection(ws);
      console.error('[node-backend]', `Client connected: ${connectionId}`);

      // Send ready signal
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

    httpServer.on('error', (err: Error) => {
      reject(err);
    });

    httpServer.listen(port, () => {
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
