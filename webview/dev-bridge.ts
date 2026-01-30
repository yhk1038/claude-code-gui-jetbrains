/**
 * Development Bridge for Claude Code CLI
 *
 * Vite dev server에서 WebSocket을 통해 Claude CLI와 통신
 */
import { spawn, ChildProcess } from 'child_process';
import { createRequire } from 'module';
import type { ViteDevServer } from 'vite';
import type { WebSocket, WebSocketServer } from 'ws';
import { readFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';

const require = createRequire(import.meta.url);

interface IPCMessage {
  type: string;
  requestId?: string;
  payload?: Record<string, unknown>;
  timestamp: number;
}

let claudeProcess: ChildProcess | null = null;
let currentWebSocket: WebSocket | null = null;
let sessionId: string | null = null;
let isFirstMessage: boolean = true;

interface SessionEntry {
  sessionId: string;
  firstPrompt: string;
  messageCount: number;
  created: string;
  modified: string;
  gitBranch?: string;
}

interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

async function getProjectSessionsPath(workingDir: string): Promise<string> {
  // Convert project path to Claude's folder format (keeps leading dash)
  const normalizedPath = workingDir.replace(/\//g, '-');
  console.log('[dev-bridge] Sessions path:', join(homedir(), '.claude', 'projects', normalizedPath));
  return join(homedir(), '.claude', 'projects', normalizedPath);
}

async function getSessionsList(workingDir: string): Promise<SessionEntry[]> {
  try {
    const sessionsPath = await getProjectSessionsPath(workingDir);
    const indexPath = join(sessionsPath, 'sessions-index.json');

    const indexContent = await readFile(indexPath, 'utf-8');
    const index = JSON.parse(indexContent);

    // Sort by modified date descending
    const sessions = (index.entries || [])
      .filter((e: any) => !e.isSidechain)
      .map((entry: any) => ({
        sessionId: entry.sessionId,
        firstPrompt: entry.firstPrompt || 'No prompt',
        messageCount: entry.messageCount || 0,
        created: entry.created,
        modified: entry.modified,
        gitBranch: entry.gitBranch,
      }))
      .sort((a: SessionEntry, b: SessionEntry) =>
        new Date(b.modified).getTime() - new Date(a.modified).getTime()
      );

    return sessions;
  } catch (error) {
    console.error('[dev-bridge] Error reading sessions index:', error);
    return [];
  }
}

async function loadSessionMessages(workingDir: string, targetSessionId: string): Promise<SessionMessage[]> {
  try {
    const sessionsPath = await getProjectSessionsPath(workingDir);
    const sessionFile = join(sessionsPath, `${targetSessionId}.jsonl`);

    const content = await readFile(sessionFile, 'utf-8');
    const lines = content.trim().split('\n');

    const messages: SessionMessage[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line);

        if (entry.type === 'user' && entry.message?.content) {
          messages.push({
            role: 'user',
            content: typeof entry.message.content === 'string'
              ? entry.message.content
              : JSON.stringify(entry.message.content),
            timestamp: entry.timestamp,
          });
        } else if (entry.type === 'assistant' && entry.message?.content) {
          // Assistant content is an array of blocks
          const textContent = Array.isArray(entry.message.content)
            ? entry.message.content
                .filter((block: any) => block.type === 'text')
                .map((block: any) => block.text)
                .join('\n')
            : entry.message.content;

          if (textContent) {
            messages.push({
              role: 'assistant',
              content: textContent,
              timestamp: entry.timestamp,
            });
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    return messages;
  } catch (error) {
    console.error('[dev-bridge] Error loading session:', error);
    return [];
  }
}

function sendToClient(ws: WebSocket, type: string, payload: Record<string, unknown> = {}) {
  const message: IPCMessage = {
    type,
    payload,
    timestamp: Date.now(),
  };
  ws.send(JSON.stringify(message));
}

function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function startClaudeProcess(ws: WebSocket, content: string, workingDir: string) {
  // Kill existing process if any
  if (claudeProcess) {
    claudeProcess.kill();
    claudeProcess = null;
  }

  console.log('[dev-bridge] Starting Claude CLI process...');
  console.log('[dev-bridge] Working directory:', workingDir);
  console.log('[dev-bridge] Message:', content.substring(0, 100) + '...');

  // Generate session ID if not exists (first message)
  let args: string[];
  if (!sessionId) {
    sessionId = generateSessionId();
    console.log('[dev-bridge] New session created:', sessionId);
    args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--session-id', sessionId,
      '--',
      content
    ];
  } else {
    console.log('[dev-bridge] Resuming existing session:', sessionId);
    args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--resume', sessionId,
      '--',
      content
    ];
  }
  console.log('[dev-bridge] Command: claude ' + args.map(a => JSON.stringify(a)).join(' '));

  claudeProcess = spawn('claude', args, {
    cwd: workingDir,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      // Claude CLI가 터미널이 아닌 환경에서 실행됨을 알림
      TERM: 'dumb',
      CI: 'true',
      PATH: process.env.PATH,
    }
  });

  console.log('[dev-bridge] Claude CLI spawned with PID:', claudeProcess.pid);
  console.log('[dev-bridge] stdout exists:', !!claudeProcess.stdout);
  console.log('[dev-bridge] stderr exists:', !!claudeProcess.stderr);

  // Close stdin immediately to signal no more input
  claudeProcess.stdin?.end();
  console.log('[dev-bridge] stdin closed');

  claudeProcess.on('spawn', () => {
    console.log('[dev-bridge] Process spawned successfully');
  });

  currentWebSocket = ws;

  // Send stream start
  sendToClient(ws, 'STREAM_START');

  let buffer = '';

  claudeProcess.stdout?.on('data', (data: Buffer) => {
    const chunk = data.toString();
    console.log('[dev-bridge] RAW stdout:', chunk.substring(0, 200));
    buffer += chunk;

    // stream-json 모드에서는 줄 단위로 JSON 객체가 출력됨
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // 마지막 불완전한 줄은 버퍼에 유지

    console.log('[dev-bridge] Parsed lines count:', lines.length);

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const event = JSON.parse(line);
        console.log('[dev-bridge] JSON event type:', event.type);
        handleStreamEvent(ws, event);
      } catch {
        // JSON이 아닌 경우 텍스트로 처리
        console.log('[dev-bridge] Non-JSON output:', line);
        sendToClient(ws, 'STREAM_DELTA', { delta: line + '\n' });
      }
    }
  });

  claudeProcess.stderr?.on('data', (data: Buffer) => {
    const error = data.toString();
    console.error('[dev-bridge] Claude CLI stderr:', error);
    // stderr도 UI에 표시 (에러 메시지)
    sendToClient(ws, 'STREAM_DELTA', { delta: error });
  });

  claudeProcess.on('close', (code) => {
    console.log('[dev-bridge] Claude CLI process exited with code:', code);

    // 남은 버퍼 처리
    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer);
        handleStreamEvent(ws, event);
      } catch {
        sendToClient(ws, 'STREAM_DELTA', { delta: buffer });
      }
    }

    sendToClient(ws, 'STREAM_END');
    claudeProcess = null;
    currentWebSocket = null;
  });

  claudeProcess.on('error', (error) => {
    console.error('[dev-bridge] Failed to start Claude CLI:', error);
    sendToClient(ws, 'SERVICE_ERROR', { error: error.message });
    sendToClient(ws, 'STREAM_END');
    claudeProcess = null;
    currentWebSocket = null;
  });
}

function handleStreamEvent(ws: WebSocket, event: Record<string, unknown>) {
  // Claude CLI stream-json 이벤트 처리
  // 참고: https://docs.anthropic.com/claude/reference/streaming

  const eventType = event.type as string;

  switch (eventType) {
    case 'content_block_start':
    case 'message_start':
      // 시작 이벤트, 무시
      break;

    case 'content_block_delta':
      // 텍스트 델타
      const delta = event.delta as Record<string, unknown>;
      if (delta?.type === 'text_delta' && delta?.text) {
        sendToClient(ws, 'STREAM_DELTA', { delta: delta.text as string });
      }
      break;

    case 'message_delta':
      // 메시지 완료 상태
      break;

    case 'message_stop':
      // 메시지 종료
      break;

    case 'error':
      sendToClient(ws, 'SERVICE_ERROR', { error: event.error || 'Unknown error' });
      break;

    default:
      // 알 수 없는 이벤트 타입이면 result 체크
      if (event.result) {
        // 최종 결과 (--print 모드)
        const result = event.result as string;
        sendToClient(ws, 'STREAM_DELTA', { delta: result });
      } else if (event.content) {
        // content 필드가 있는 경우
        const content = event.content as string;
        sendToClient(ws, 'STREAM_DELTA', { delta: content });
      }
      break;
  }
}

function stopClaudeProcess() {
  if (claudeProcess) {
    console.log('[dev-bridge] Stopping Claude CLI process...');
    claudeProcess.kill('SIGTERM');
    claudeProcess = null;
  }
}

export function devBridgePlugin() {
  return {
    name: 'dev-bridge',
    configureServer(server: ViteDevServer) {
      // WebSocket 서버 생성
      const { WebSocketServer } = require('ws') as { WebSocketServer: new (options: { noServer: true }) => WebSocketServer };
      const wss = new WebSocketServer({ noServer: true });

      // HTTP 서버의 upgrade 이벤트 처리
      server.httpServer?.on('upgrade', (request, socket, head) => {
        if (request.url === '/ws') {
          wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
            wss.emit('connection', ws, request);
          });
        }
      });

      // WebSocket 연결 처리
      wss.on('connection', (ws: WebSocket) => {
        console.log('[dev-bridge] Client connected');

        // 연결 확인 메시지 전송
        sendToClient(ws, 'BRIDGE_READY');

        ws.on('message', async (data: Buffer) => {
          try {
            const message: IPCMessage = JSON.parse(data.toString());
            console.log('[dev-bridge] Received:', message.type);

            switch (message.type) {
              case 'SEND_MESSAGE':
                const content = message.payload?.content as string;
                const workingDir = message.payload?.workingDir as string || process.cwd();
                if (content) {
                  startClaudeProcess(ws, content, workingDir);
                }
                // ACK 전송
                sendToClient(ws, 'ACK', { requestId: message.requestId });
                break;

              case 'STOP_GENERATION':
                stopClaudeProcess();
                sendToClient(ws, 'ACK', { requestId: message.requestId });
                break;

              case 'NEW_SESSION':
                sessionId = null;
                isFirstMessage = true;
                console.log('[dev-bridge] Session cleared, will create new on next message');
                sendToClient(ws, 'ACK', { requestId: message.requestId });
                break;

              case 'GET_SESSIONS':
                const sessionsWorkingDir = message.payload?.workingDir as string || process.cwd();
                const sessions = await getSessionsList(sessionsWorkingDir);
                sendToClient(ws, 'SESSIONS_LIST', { sessions });
                sendToClient(ws, 'ACK', { requestId: message.requestId });
                break;

              case 'LOAD_SESSION':
                const loadWorkingDir = message.payload?.workingDir as string || process.cwd();
                const loadSessionId = message.payload?.sessionId as string;
                if (loadSessionId) {
                  // Update current session ID
                  sessionId = loadSessionId;
                  const loadedMessages = await loadSessionMessages(loadWorkingDir, loadSessionId);
                  sendToClient(ws, 'SESSION_LOADED', {
                    sessionId: loadSessionId,
                    messages: loadedMessages
                  });
                }
                sendToClient(ws, 'ACK', { requestId: message.requestId });
                break;

              default:
                console.log('[dev-bridge] Unknown message type:', message.type);
            }
          } catch (error) {
            console.error('[dev-bridge] Error parsing message:', error);
          }
        });

        ws.on('close', () => {
          console.log('[dev-bridge] Client disconnected');
          stopClaudeProcess();
        });
      });

      console.log('[dev-bridge] WebSocket server initialized at /ws');
    },
  };
}
