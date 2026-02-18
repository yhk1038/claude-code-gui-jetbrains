/**
 * Development Bridge for Claude Code CLI
 *
 * Vite dev server에서 WebSocket을 통해 Claude CLI와 통신
 */
import { spawn, exec, ChildProcess } from 'child_process';
import { createRequire } from 'module';
import type { ViteDevServer } from 'vite';
import type { WebSocket, WebSocketServer } from 'ws';
import { readFile, readdir } from 'fs/promises';
import { existsSync, statSync } from 'fs';
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

interface ProjectEntry {
  name: string;       // 폴더 이름 (프로젝트 이름)
  path: string;       // 전체 경로 (워킹 디렉토리)
  sessionCount: number;
  lastModified: string;
}

// Raw JSONL entry - passed through as-is to match Kotlin backend
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SessionMessage = Record<string, any>;

async function getProjectSessionsPath(workingDir: string): Promise<string> {
  // Convert project path to Claude's folder format (keeps leading dash)
  const normalizedPath = workingDir.replace(/\//g, '-');
  console.log('[dev-bridge] Sessions path:', join(homedir(), '.claude', 'projects', normalizedPath));
  return join(homedir(), '.claude', 'projects', normalizedPath);
}

/**
 * Extract session info from JSONL file (Cursor-compatible)
 */
interface MessageInfo {
  uuid: string;
  parentUuid: string | null;
  type: string;
  isSidechain: boolean;
  timestamp: string | null;
  isMeta: boolean;
  content: any; // JsonElement
}

interface SessionInfo {
  title: string;
  lastTimestamp: string | null;
  createdAt: string;
  messageCount: number;
  isSidechain: boolean;
}

function removeSystemTags(text: string): string {
  // Remove XML-style tags and their content
  const tagPattern = /<[^>]+>[^<]*<\/[^>]+>/g;
  let cleaned = text.replace(tagPattern, '');

  // Remove self-closing or unclosed tags
  const singleTagPattern = /<[^>]+>/g;
  cleaned = cleaned.replace(singleTagPattern, '');

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // If everything was removed, return original text
  return cleaned.length > 0 ? cleaned : text;
}

function extractTextFromContent(content: any): string | null {
  if (Array.isArray(content)) {
    const lastTextBlock = content.filter((block: any) => block.type === 'text').pop();
    return lastTextBlock?.text ?? null;
  } else if (typeof content === 'string') {
    return content;
  }
  return null;
}

function buildTranscript(leaf: MessageInfo, messages: Map<string, MessageInfo>): MessageInfo[] {
  const transcript: MessageInfo[] = [];
  let current: MessageInfo | undefined = leaf;

  while (current) {
    transcript.unshift(current); // Add to front
    current = current.parentUuid ? messages.get(current.parentUuid) : undefined;
  }

  return transcript;
}

async function extractSessionInfo(file: string): Promise<SessionInfo> {
  const messages = new Map<string, MessageInfo>(); // uuid -> MessageInfo
  const summaries = new Map<string, string>(); // leafUuid -> summary
  let lastUuid: string | null = null;
  let firstTimestamp: string | null = null;
  let messageCount = 0;
  let firstUserPrompt: string | null = null;
  let hasSlug = false;
  let hasFileHistorySnapshot = false;
  let skipSession = false;

  // Step 1: Collect all messages into Map
  const content = await readFile(file, 'utf-8');
  const lines = content.trim().split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      messageCount++;

      const uuid = entry.uuid ?? null;
      const parentUuid = entry.parentUuid ?? null;
      const type = entry.type ?? null;
      const timestamp = entry.timestamp ?? null;
      const isSidechain = entry.isSidechain ?? false;
      const isMeta = entry.isMeta ?? false;

      if (timestamp && firstTimestamp === null) {
        firstTimestamp = timestamp;
      }

      // Cursor performRefresh: check first relevant message for isSidechain
      if (messages.size === 0 && ['user', 'assistant', 'attachment', 'system'].includes(type)) {
        if (isSidechain) {
          skipSession = true;
          break;
        }
      }

      // Collect summaries
      if (type === 'summary') {
        const leafUuid = entry.leafUuid ?? null;
        const summary = entry.summary ?? null;
        if (leafUuid && summary) {
          summaries.set(leafUuid, summary);
        }
      }

      // Check for slug field
      if (!hasSlug && entry.slug) {
        hasSlug = true;
      }

      // Check for file-history-snapshot type
      if (!hasFileHistorySnapshot && type === 'file-history-snapshot') {
        hasFileHistorySnapshot = true;
      }

      // Add to messages Map (only relevant types)
      if (uuid && type && ['user', 'assistant', 'attachment', 'system', 'progress'].includes(type)) {
        const messageObj = entry.message ?? null;
        const content = messageObj?.content ?? null;

        messages.set(uuid, {
          uuid,
          parentUuid,
          type,
          isSidechain,
          timestamp,
          isMeta,
          content,
        });

        lastUuid = uuid;
      }
    } catch {
      // Skip malformed lines
    }
  }

  if (skipSession) {
    return {
      title: 'Sidechain Session',
      lastTimestamp: null,
      createdAt: firstTimestamp || '',
      messageCount,
      isSidechain: true,
    };
  }

  // Filter out sessions without BOTH slug AND file-history-snapshot (Cursor compatibility)
  if (!hasSlug && !hasFileHistorySnapshot) {
    return {
      title: 'Incomplete Session',
      lastTimestamp: null,
      createdAt: firstTimestamp || '',
      messageCount,
      isSidechain: true, // Treat as sidechain to filter it out
    };
  }

  // Filter out sessions without any user or assistant messages (empty sessions)
  const hasUserOrAssistant = Array.from(messages.values()).some(
    (m) => m.type === 'user' || m.type === 'assistant'
  );
  if (!hasUserOrAssistant) {
    return {
      title: 'Empty Session',
      lastTimestamp: null,
      createdAt: firstTimestamp || '',
      messageCount,
      isSidechain: true, // Treat as sidechain to filter it out
    };
  }

  // Step 2: Find leaf messages (messages that are not parents of other messages)
  const allParentUuids = new Set(Array.from(messages.values()).map((m) => m.parentUuid).filter(Boolean));
  const leafMessages = Array.from(messages.values()).filter((m) => !allParentUuids.has(m.uuid));

  // Step 3: Build transcripts from each leaf
  const transcripts = leafMessages.map((leaf) => buildTranscript(leaf, messages));

  // Step 4: Extract isSidechain from first message of first transcript (Cursor fetchSessions logic)
  const isSidechainFromTranscript = transcripts[0]?.[0]?.isSidechain ?? false;

  // Step 5: Extract first user prompt from first transcript
  for (const transcript of transcripts) {
    for (const msg of transcript) {
      if (msg.type === 'user' && !msg.isMeta && firstUserPrompt === null) {
        const text = extractTextFromContent(msg.content);
        if (text) {
          // Remove system tags from the prompt for cleaner title
          firstUserPrompt = removeSystemTags(text.replace(/\n/g, ' ').trim());
          break;
        }
      }
    }
    if (firstUserPrompt) break;
  }

  // Step 6: Determine title (first summary > firstUserPrompt > fallback)
  const firstSummary = summaries.size > 0 ? Array.from(summaries.values())[0] : null;
  const title = firstSummary ?? firstUserPrompt ?? 'No title';

  // Step 7: Find last timestamp from all messages
  const lastTimestamp = Array.from(messages.values())
    .map((m) => m.timestamp)
    .filter(Boolean)
    .sort()
    .pop() ?? null;

  return {
    title,
    lastTimestamp,
    createdAt: firstTimestamp || '',
    messageCount,
    isSidechain: isSidechainFromTranscript,
  };
}

async function getSessionsList(workingDir: string): Promise<SessionEntry[]> {
  console.log('[dev-bridge] getSessionsList called with:', workingDir);
  try {
    const sessionsPath = await getProjectSessionsPath(workingDir);
    console.log('[dev-bridge] Sessions dir:', sessionsPath);

    if (!existsSync(sessionsPath)) {
      console.warn('[dev-bridge] Sessions dir not found:', sessionsPath);
      return [];
    }

    // Scan all .jsonl files in directory (Cursor approach)
    const files = await readdir(sessionsPath);
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

    console.log('[dev-bridge] Found .jsonl files:', jsonlFiles.length);

    const sessions: SessionEntry[] = [];

    for (const file of jsonlFiles) {
      try {
        const sessionId = file.replace(/\.jsonl$/, '');
        const fullPath = join(sessionsPath, file);
        const sessionInfo = await extractSessionInfo(fullPath);

        // Skip sidechain sessions
        if (sessionInfo.isSidechain) {
          continue;
        }

        sessions.push({
          sessionId,
          firstPrompt: sessionInfo.title,
          messageCount: sessionInfo.messageCount,
          created: sessionInfo.createdAt,
          modified: sessionInfo.lastTimestamp ?? sessionInfo.createdAt,
        });
      } catch (err) {
        console.warn('[dev-bridge] Failed to parse session file:', file, err);
      }
    }

    // Sort by modified date descending
    sessions.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

    console.log('[dev-bridge] Returning sessions count:', sessions.length);
    return sessions;
  } catch (error) {
    console.error('[dev-bridge] Error reading sessions:', error);
    return [];
  }
}

async function getProjectsList(): Promise<ProjectEntry[]> {
  try {
    const projectsDir = join(homedir(), '.claude', 'projects');
    const entries = await readdir(projectsDir, { withFileTypes: true });

    const projects: ProjectEntry[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue; // hidden folders

      // Try to read sessions-index.json to get project path and session count
      let path: string | null = null;
      let sessionCount = 0;
      let lastModified = new Date().toISOString();

      try {
        const indexPath = join(projectsDir, entry.name, 'sessions-index.json');
        const indexContent = await readFile(indexPath, 'utf-8');
        const index = JSON.parse(indexContent);
        const validEntries = (index.entries || []).filter((e: any) => !e.isSidechain);
        sessionCount = validEntries.length;

        // Get projectPath from first valid entry
        if (validEntries.length > 0 && validEntries[0].projectPath) {
          path = validEntries[0].projectPath;
        }

        // Get the most recent modified date
        if (validEntries.length > 0) {
          const dates = validEntries.map((e: any) => new Date(e.modified || e.created).getTime());
          lastModified = new Date(Math.max(...dates)).toISOString();
        }
      } catch {
        // No sessions-index.json or no valid entries, skip this project
        continue;
      }

      // Skip if we couldn't determine the project path
      if (!path) continue;

      const name = path.split('/').pop() || path;

      projects.push({
        name,
        path,
        sessionCount,
        lastModified,
      });
    }

    // Sort by lastModified descending
    projects.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    return projects;
  } catch (error) {
    console.error('[dev-bridge] Error reading projects list:', error);
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
        // Raw JSONL entry 그대로 전달 (type 필터링 제거)
        messages.push(entry);
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
                // ACK에 sessions 포함 (send()가 ACK payload만 반환하므로)
                sendToClient(ws, 'ACK', { requestId: message.requestId, sessions });
                break;

              case 'GET_PROJECTS':
                const projects = await getProjectsList();
                // PROJECTS_LIST를 먼저 보내고 (ProjectSelector가 subscribe로 기다림)
                sendToClient(ws, 'PROJECTS_LIST', { projects });
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

              case 'OPEN_FILE':
                const openFilePath = message.payload?.filePath as string;
                if (openFilePath) {
                  console.log('[dev-bridge] Opening file:', openFilePath);
                  try {
                    // macOS: use 'open' command which opens in default app
                    // For code files, this typically opens in the user's default code editor
                    exec(`open "${openFilePath}"`, (error: Error | null) => {
                      if (error) {
                        console.error('[dev-bridge] Failed to open file:', error.message);
                      }
                    });
                  } catch (error) {
                    console.error('[dev-bridge] Failed to open file:', error);
                  }
                }
                sendToClient(ws, 'ACK', { requestId: message.requestId });
                break;

              case 'OPEN_SETTINGS':
                console.log('[dev-bridge] OPEN_SETTINGS requested (browser handles via window.open)');
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
