/**
 * Development Bridge for Claude Code CLI
 *
 * Vite dev server에서 WebSocket을 통해 Claude CLI와 통신
 */
import { spawn, exec, ChildProcess } from 'child_process';
import { createRequire } from 'module';
import type { ViteDevServer } from 'vite';
import type { WebSocket, WebSocketServer } from 'ws';
import { readFile, readdir, writeFile, mkdir } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

const require = createRequire(import.meta.url);

// InputMode -> CLI --permission-mode flag mapping
const INPUT_MODE_TO_CLI_FLAG: Record<string, string> = {
  plan: 'plan',
  bypass: 'bypassPermissions',
  ask_before_edit: 'default',
  auto_edit: 'acceptEdits',
};

interface IPCMessage {
  type: string;
  requestId?: string;
  payload?: Record<string, unknown>;
  timestamp: number;
}

// ─── Session Registry (Pub/Sub) ─────────────────────────────────────────────

interface SessionRecord {
  sessionId: string;
  process: ChildProcess | null;
  subscribers: Set<WebSocket>;
  buffer: string;          // stdout 파싱용 줄 버퍼
  workingDir: string;
}

interface ClientRecord {
  subscribedSessionId: string | null;
}

/** sessionId -> SessionRecord */
const sessionRegistry = new Map<string, SessionRecord>();

/** ws -> ClientRecord */
const clientRegistry = new Map<WebSocket, ClientRecord>();

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

/**
 * 특정 세션의 모든 구독자에게 메시지 브로드캐스트.
 * 전송 실패한 ws는 조용히 무시 (disconnect 이벤트에서 정리됨).
 */
function broadcastToSession(sessionId: string, type: string, payload: Record<string, unknown> = {}, excludeWs?: WebSocket) {
  const session = sessionRegistry.get(sessionId);
  if (!session) return;

  const message: IPCMessage = {
    type,
    payload,
    timestamp: Date.now(),
  };
  const data = JSON.stringify(message);

  for (const ws of session.subscribers) {
    if (ws === excludeWs) continue;
    try {
      if (ws.readyState === 1 /* WebSocket.OPEN */) {
        ws.send(data);
      }
    } catch {
      // 전송 실패 — disconnect 핸들러에서 정리
    }
  }
}

/**
 * ws를 sessionId에 구독. 기존 구독이 있으면 자동 해제 후 새 구독.
 * SessionRecord가 없으면 생성 (프로세스 없는 빈 레코드).
 */
function subscribeToSession(ws: WebSocket, sessionId: string) {
  // 기존 구독 해제
  unsubscribeFromSession(ws);

  // SessionRecord 없으면 생성
  if (!sessionRegistry.has(sessionId)) {
    sessionRegistry.set(sessionId, {
      sessionId,
      process: null,
      subscribers: new Set(),
      buffer: '',
      workingDir: process.cwd(),
    });
  }

  const session = sessionRegistry.get(sessionId)!;
  session.subscribers.add(ws);

  // ClientRecord 갱신
  const client = clientRegistry.get(ws);
  if (client) {
    client.subscribedSessionId = sessionId;
  }

  console.log(`[dev-bridge] WS subscribed to session ${sessionId} (subscribers: ${session.subscribers.size})`);
}

/**
 * ws의 현재 구독 해제. 구독자가 0이 되면 cleanupSession 호출.
 */
function unsubscribeFromSession(ws: WebSocket) {
  const client = clientRegistry.get(ws);
  if (!client?.subscribedSessionId) return;

  const sessionId = client.subscribedSessionId;
  const session = sessionRegistry.get(sessionId);

  if (session) {
    session.subscribers.delete(ws);
    console.log(`[dev-bridge] WS unsubscribed from session ${sessionId} (subscribers: ${session.subscribers.size})`);

    if (session.subscribers.size === 0) {
      cleanupSession(sessionId);
    }
  }

  client.subscribedSessionId = null;
}

/**
 * 세션 프로세스 종료 + 레지스트리에서 제거.
 */
function cleanupSession(sessionId: string) {
  const session = sessionRegistry.get(sessionId);
  if (!session) return;

  if (session.process) {
    console.log(`[dev-bridge] Killing process for session ${sessionId} (PID: ${session.process.pid})`);
    session.process.kill('SIGTERM');
    session.process = null;
  }

  sessionRegistry.delete(sessionId);
  console.log(`[dev-bridge] Session ${sessionId} cleaned up`);
}

function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function startClaudeProcess(ws: WebSocket, content: string, workingDir: string, targetSessionId: string, isNewSession: boolean, inputMode?: string) {
  // 동일 세션의 기존 프로세스 kill (같은 세션에 새 메시지 전송 시)
  const existingSession = sessionRegistry.get(targetSessionId);
  if (existingSession?.process) {
    console.log(`[dev-bridge] Killing existing process for session ${targetSessionId}`);
    existingSession.process.kill('SIGTERM');
    existingSession.process = null;
  }

  console.log('[dev-bridge] Starting Claude CLI process...');
  console.log('[dev-bridge] Working directory:', workingDir);
  console.log('[dev-bridge] Message:', content.substring(0, 100) + '...');

  // ws를 이 세션에 구독
  subscribeToSession(ws, targetSessionId);

  let args: string[];
  if (isNewSession) {
    console.log('[dev-bridge] New session:', targetSessionId);
    args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--session-id', targetSessionId,
      '--',
      content
    ];
  } else {
    console.log('[dev-bridge] Resuming session:', targetSessionId);
    args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--resume', targetSessionId,
      '--',
      content
    ];
  }
  // Add --permission-mode flag if inputMode is provided
  if (inputMode) {
    const cliFlag = INPUT_MODE_TO_CLI_FLAG[inputMode];
    if (cliFlag) {
      const separatorIndex = args.indexOf('--');
      if (separatorIndex !== -1) {
        args.splice(separatorIndex, 0, '--permission-mode', cliFlag);
      } else {
        args.push('--permission-mode', cliFlag);
      }
    }
  }
  console.log('[dev-bridge] Command: claude ' + args.map(a => JSON.stringify(a)).join(' '));

  const proc = spawn('claude', args, {
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

  console.log('[dev-bridge] Claude CLI spawned with PID:', proc.pid);
  console.log('[dev-bridge] stdout exists:', !!proc.stdout);
  console.log('[dev-bridge] stderr exists:', !!proc.stderr);

  // SessionRecord 갱신
  const sessionRecord = sessionRegistry.get(targetSessionId)!;
  sessionRecord.process = proc;
  sessionRecord.buffer = '';
  sessionRecord.workingDir = workingDir;

  // Close stdin immediately to signal no more input
  proc.stdin?.end();
  console.log('[dev-bridge] stdin closed');

  proc.on('spawn', () => {
    console.log('[dev-bridge] Process spawned successfully');
  });

  // 모든 구독자에게 스트림 시작 알림
  broadcastToSession(targetSessionId, 'STREAM_START');

  proc.stdout?.on('data', (data: Buffer) => {
    const chunk = data.toString();
    console.log('[dev-bridge] RAW stdout:', chunk.substring(0, 200));

    const sr = sessionRegistry.get(targetSessionId);
    if (!sr) return; // 세션이 이미 정리됨
    sr.buffer += chunk;

    const lines = sr.buffer.split('\n');
    sr.buffer = lines.pop() || '';

    console.log('[dev-bridge] Parsed lines count:', lines.length);

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const event = JSON.parse(line);
        console.log('[dev-bridge] JSON event type:', event.type);
        handleStreamEvent(targetSessionId, event);
      } catch {
        console.log('[dev-bridge] Non-JSON output (unexpected in stream-json mode):', line);
      }
    }
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const error = data.toString();
    console.error('[dev-bridge] Claude CLI stderr:', error);
    // stream-json 모드에서는 stderr를 로그만 남기고 UI에는 전송하지 않음
  });

  proc.on('close', (code) => {
    console.log('[dev-bridge] Claude CLI process exited with code:', code);

    const sr = sessionRegistry.get(targetSessionId);
    // 남은 버퍼 처리
    if (sr?.buffer.trim()) {
      try {
        const event = JSON.parse(sr.buffer);
        handleStreamEvent(targetSessionId, event);
      } catch {
        console.log('[dev-bridge] Remaining buffer (non-JSON):', sr.buffer);
      }
      sr.buffer = '';
    }

    broadcastToSession(targetSessionId, 'STREAM_END');

    // 프로세스 참조만 해제 (세션 레코드는 유지 — 구독자가 아직 있을 수 있음)
    if (sr) {
      sr.process = null;
    }
  });

  proc.on('error', (error) => {
    console.error('[dev-bridge] Failed to start Claude CLI:', error);
    broadcastToSession(targetSessionId, 'SERVICE_ERROR', { error: error.message });
    broadcastToSession(targetSessionId, 'STREAM_END');

    const sr = sessionRegistry.get(targetSessionId);
    if (sr) {
      sr.process = null;
    }
  });
}

function handleStreamEvent(targetSessionId: string, event: Record<string, unknown>) {
  // Claude CLI --output-format stream-json 이벤트 처리
  // CLI 출력 타입: system, stream_event, assistant, result

  const eventType = event.type as string;

  switch (eventType) {
    case 'system':
      // 세션 초기화 이벤트
      broadcastToSession(targetSessionId, 'STREAM_EVENT', {
        eventType: 'system',
        subtype: event.subtype,
        sessionId: event.session_id,
        cwd: event.cwd,
        model: event.model,
      });
      break;

    case 'stream_event': {
      // Anthropic API 이벤트를 래핑한 CLI 이벤트
      // 구조: { type: "stream_event", event: { type: "content_block_delta", ... } }
      const innerEvent = event.event as Record<string, unknown>;
      if (!innerEvent) {
        console.log('[dev-bridge] stream_event with no inner event, skipping');
        break;
      }

      const innerType = innerEvent.type as string;
      const deltaData: Record<string, unknown> = { event: innerType };

      if (innerEvent.index !== undefined) {
        deltaData.index = innerEvent.index;
      }

      if (innerEvent.delta) {
        const delta = innerEvent.delta as Record<string, unknown>;
        const deltaType = delta.type as string;

        if (deltaType === 'text_delta') {
          deltaData.delta = { type: 'text_delta', text: delta.text };
        } else if (deltaType === 'tool_use_delta') {
          deltaData.delta = {
            type: 'tool_use_delta',
            id: delta.id,
            name: delta.name,
            input: delta.input,
          };
        } else if (deltaType === 'thinking_delta') {
          deltaData.delta = { type: 'thinking_delta', thinking: delta.thinking };
        } else {
          deltaData.delta = delta;
        }
      }

      if (innerEvent.message) {
        deltaData.message = innerEvent.message;
      }

      if (innerEvent.content_block) {
        deltaData.contentBlock = innerEvent.content_block;
      }

      broadcastToSession(targetSessionId, 'STREAM_EVENT', deltaData);
      break;
    }

    case 'assistant': {
      // 완성된 어시스턴트 메시지
      const message = event.message as Record<string, unknown> | undefined;
      broadcastToSession(targetSessionId, 'ASSISTANT_MESSAGE', {
        messageId: message?.id,
        content: message?.content || [],
      });
      break;
    }

    case 'result': {
      // 완료 결과
      const errorField = event.error as Record<string, unknown> | undefined;
      broadcastToSession(targetSessionId, 'RESULT_MESSAGE', {
        status: event.subtype || event.status || 'unknown',
        isError: event.is_error || false,
        result: event.result || null,
        sessionId: event.session_id || null,
        error: errorField
          ? {
              code: errorField.code,
              message: errorField.message,
              details: errorField.details,
            }
          : null,
      });
      break;
    }

    default:
      console.log('[dev-bridge] Unknown CLI event type:', eventType, event);
      break;
  }
}

// ─── Settings helpers ────────────────────────────────────────────────────────

const SETTINGS_FILE = join(homedir(), '.claude-code-gui', 'settings.js');

const DEFAULT_SETTINGS: Record<string, unknown> = {
  cliPath: null,
  permissionMode: 'ALWAYS_ASK',
  autoApplyLowRisk: false,
  theme: 'system',
  fontSize: 13,
  debugMode: false,
  logLevel: 'info',
  initialInputMode: 'ask_before_edit',
};

const COMMENT_MAP: Record<string, string> = {
  cliPath: 'Claude CLI 실행 파일 경로 (null이면 자동 감지)',
  permissionMode: '권한 모드: "ALWAYS_ASK" | "AUTO_APPROVE_SAFE" | "AUTO_APPROVE_ALL"',
  autoApplyLowRisk: '저위험 변경사항 자동 적용 여부',
  theme: '테마: "system" | "light" | "dark"',
  fontSize: '글꼴 크기 (8~32)',
  debugMode: '디버그 모드 활성화',
  logLevel: '로그 레벨: "debug" | "info" | "warn" | "error"',
  initialInputMode: '기본 입력 모드: "plan" | "bypass" | "ask_before_edit" | "auto_edit"',
};

function generateSettingsContent(settings: Record<string, unknown>): string {
  const lines: string[] = ['export default {'];
  const keys = Object.keys(DEFAULT_SETTINGS);
  for (const key of keys) {
    const value = key in settings ? settings[key] : DEFAULT_SETTINGS[key];
    const comment = COMMENT_MAP[key];
    if (comment) {
      lines.push(`  // ${comment}`);
    }
    const serialized = value === null ? 'null' : JSON.stringify(value);
    lines.push(`  ${key}: ${serialized},`);
  }
  lines.push('};');
  return lines.join('\n') + '\n';
}

async function readSettingsFile(): Promise<Record<string, unknown>> {
  try {
    if (!existsSync(SETTINGS_FILE)) {
      // Create with defaults
      await mkdir(join(homedir(), '.claude-code-gui'), { recursive: true });
      await writeFile(SETTINGS_FILE, generateSettingsContent(DEFAULT_SETTINGS), 'utf-8');
      return { ...DEFAULT_SETTINGS };
    }

    const raw = await readFile(SETTINGS_FILE, 'utf-8');

    // Strip block comments
    let stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '');

    // Strip line comments (preserving strings)
    stripped = stripped.replace(/\/\/[^\n]*/g, '');

    // Remove `export default` prefix and trailing semicolon
    stripped = stripped.replace(/^\s*export\s+default\s*/, '').replace(/;\s*$/, '').trim();

    // Add quotes to unquoted keys: word chars followed by colon
    stripped = stripped.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":');

    // Remove trailing commas before closing braces/brackets
    stripped = stripped.replace(/,\s*([\]}])/g, '$1');

    const parsed = JSON.parse(stripped);

    // Merge with defaults so missing keys get default values
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.error('[dev-bridge] Failed to read settings file, using defaults:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

interface SaveResult {
  status: 'ok' | 'error';
  error?: string;
}

function validateSetting(key: string, value: unknown): string | null {
  if (!(key in DEFAULT_SETTINGS)) {
    return `Unknown settings key: ${key}`;
  }
  switch (key) {
    case 'permissionMode':
      if (!['ALWAYS_ASK', 'AUTO_APPROVE_SAFE', 'AUTO_APPROVE_ALL'].includes(value as string)) {
        return 'permissionMode must be one of "ALWAYS_ASK", "AUTO_APPROVE_SAFE", "AUTO_APPROVE_ALL"';
      }
      break;
    case 'theme':
      if (!['system', 'light', 'dark'].includes(value as string)) {
        return 'theme must be one of "system", "light", "dark"';
      }
      break;
    case 'fontSize': {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 8 || n > 32) {
        return 'fontSize must be an integer between 8 and 32';
      }
      break;
    }
    case 'autoApplyLowRisk':
    case 'debugMode':
      if (typeof value !== 'boolean') {
        return `${key} must be a boolean`;
      }
      break;
    case 'logLevel':
      if (!['debug', 'info', 'warn', 'error'].includes(value as string)) {
        return 'logLevel must be one of "debug", "info", "warn", "error"';
      }
      break;
    case 'initialInputMode':
      if (!['plan', 'bypass', 'ask_before_edit', 'auto_edit'].includes(value as string)) {
        return 'initialInputMode must be one of "plan", "bypass", "ask_before_edit", "auto_edit"';
      }
      break;
    case 'cliPath':
      if (value !== null && typeof value !== 'string') {
        return 'cliPath must be a string or null';
      }
      break;
  }
  return null;
}

async function saveSettingToFile(key: string, value: unknown): Promise<SaveResult> {
  const validationError = validateSetting(key, value);
  if (validationError) {
    return { status: 'error', error: validationError };
  }

  try {
    const current = await readSettingsFile();
    current[key] = value;
    await mkdir(join(homedir(), '.claude-code-gui'), { recursive: true });
    await writeFile(SETTINGS_FILE, generateSettingsContent(current), 'utf-8');
    return { status: 'ok' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[dev-bridge] Failed to save setting:', err);
    return { status: 'error', error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

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

        // 클라이언트 레지스트리에 등록
        clientRegistry.set(ws, { subscribedSessionId: null });

        // 연결 확인 메시지 전송
        sendToClient(ws, 'BRIDGE_READY');

        ws.on('message', async (data: Buffer) => {
          try {
            const message: IPCMessage = JSON.parse(data.toString());
            console.log('[dev-bridge] Received:', message.type);

            switch (message.type) {
              case 'SEND_MESSAGE': {
                const content = message.payload?.content as string;
                const workingDir = message.payload?.workingDir as string || process.cwd();
                const msgSessionId = message.payload?.sessionId as string | undefined;
                const isNewSession = message.payload?.isNewSession as boolean ?? false;
                const inputMode = message.payload?.inputMode as string | undefined;
                const resolvedSessionId = msgSessionId || generateSessionId();
                if (content) {
                  startClaudeProcess(ws, content, workingDir, resolvedSessionId, isNewSession, inputMode);
                  // 다른 구독자에게 사용자 메시지 브로드캐스트 (보낸 ws 제외)
                  broadcastToSession(resolvedSessionId, 'USER_MESSAGE_BROADCAST', {
                    content: content.trim(),
                    sessionId: resolvedSessionId,
                  }, ws);
                }
                sendToClient(ws, 'ACK', { requestId: message.requestId });
                break;
              }

              case 'STOP_GENERATION': {
                const client = clientRegistry.get(ws);
                if (client?.subscribedSessionId) {
                  const session = sessionRegistry.get(client.subscribedSessionId);
                  if (session?.process) {
                    console.log(`[dev-bridge] Stopping process for session ${client.subscribedSessionId}`);
                    session.process.kill('SIGTERM');
                    // process = null은 close 이벤트에서 처리됨
                  }
                }
                sendToClient(ws, 'ACK', { requestId: message.requestId });
                break;
              }

              case 'NEW_SESSION':
                unsubscribeFromSession(ws);
                console.log('[dev-bridge] Client unsubscribed, will create new session on next message');
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

              case 'LOAD_SESSION': {
                const loadWorkingDir = message.payload?.workingDir as string || process.cwd();
                const loadSessionId = message.payload?.sessionId as string;
                if (loadSessionId) {
                  // 암묵적 구독: LOAD_SESSION 시 해당 세션에 자동 구독
                  subscribeToSession(ws, loadSessionId);
                  const loadedMessages = await loadSessionMessages(loadWorkingDir, loadSessionId);
                  sendToClient(ws, 'SESSION_LOADED', {
                    sessionId: loadSessionId,
                    messages: loadedMessages
                  });
                }
                sendToClient(ws, 'ACK', { requestId: message.requestId });
                break;
              }

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

              case 'GET_SETTINGS': {
                const settings = await readSettingsFile();
                sendToClient(ws, 'ACK', {
                  requestId: message.requestId,
                  status: 'ok',
                  settings,
                });
                break;
              }

              case 'SAVE_SETTINGS': {
                const key = message.payload?.key as string;
                const value = message.payload?.value;
                const result = await saveSettingToFile(key, value);
                sendToClient(ws, 'ACK', {
                  requestId: message.requestId,
                  ...result,
                });
                break;
              }

              default:
                console.log('[dev-bridge] Unknown message type:', message.type);
            }
          } catch (error) {
            console.error('[dev-bridge] Error parsing message:', error);
          }
        });

        ws.on('close', () => {
          console.log('[dev-bridge] Client disconnected');
          unsubscribeFromSession(ws);
          clientRegistry.delete(ws);
        });
      });

      console.log('[dev-bridge] WebSocket server initialized at /ws');
    },
  };
}
