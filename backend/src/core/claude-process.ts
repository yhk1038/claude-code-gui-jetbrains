import type { ConnectionManager } from '../ws/connection-manager';
import type { Bridge } from '../bridge/bridge-interface';
import { Claude } from './claude';
import { diagnoseAuthError } from './features/auth-diagnosis';
import { getStrippableAuthEnvKeys } from './features/claude-settings';
import { EditedFileTracker } from './features/editedFileTracker';
import { WorkflowProgressTracker } from './features/workflow-tracker';
import { isWslUncPath } from './wsl-path';
import { reportBackendError } from './features/telemetry';
import { MessageType } from '../shared';

// Tracks files Claude edits so the IDE can be told to reload them once the
// edit completes on disk. Shared across sessions — tool_use ids are unique.
const editedFileTracker = new EditedFileTracker();

// Tracks background dynamic workflows and streams live progress to the webview.
// Lazily created on the first stream event because it needs the (single,
// process-lifetime) ConnectionManager to broadcast from its polling timers.
let workflowTracker: WorkflowProgressTracker | null = null;
function getWorkflowTracker(connections: ConnectionManager): WorkflowProgressTracker {
  if (!workflowTracker) workflowTracker = WorkflowProgressTracker.create(connections);
  return workflowTracker;
}

// InputMode -> CLI --permission-mode flag mapping
const INPUT_MODE_TO_CLI_FLAG: Record<string, string> = {
  plan: 'plan',
  bypass: 'bypassPermissions',
  ask_before_edit: 'default',
  auto_edit: 'acceptEdits',
  auto: 'auto',
};

/**
 * Build the argv for spawning the Claude CLI in interactive print mode.
 * Extracted as a pure function so the flag composition (session flag,
 * permission mode, pinned model) is unit-testable without spawning a process.
 */
export function buildClaudeArgs(
  sessionFlag: string,
  targetSessionId: string,
  inputMode: string,
  model?: string,
): string[] {
  const args: string[] = [
    '-p',
    '--output-format',
    'stream-json',
    '--input-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--permission-prompt-tool',
    'stdio',
    sessionFlag,
    targetSessionId,
  ];

  const cliFlag = INPUT_MODE_TO_CLI_FLAG[inputMode];
  if (cliFlag) {
    args.push('--permission-mode', cliFlag);
  }

  // Pin the user-selected model so the spawn honors it even when the previous
  // process has exited — set_model only reaches a live process, so without this
  // a model picked while idle would be lost and the CLI would fall back to its
  // default. 'default' is that very fallback, so passing it is redundant; omit
  // it to avoid handing the CLI a no-op alias.
  if (model && model !== 'default') {
    args.push('--model', model);
  }

  return args;
}

// result 이벤트 수신 여부 추적 (비정상 종료 시 에러 전파 판단용)
const sessionsWithResult = new Set<string>();

// 한 번이라도 spawn된 세션 추적 (재시작 시 --resume 사용 판단용)
// --session-id: 새 세션 전용 (JSONL 이미 존재하면 "already in use" 에러)
// --resume: 기존 세션 이어받기 (JSONL이 있어야 동작)
const spawnedSessions = new Set<string>();

/**
 * 외부에서 세션을 spawned로 마킹 (다음 spawn 시 --resume 사용).
 * reclaimSession 등에서 사용.
 */
export function markSessionAsSpawned(sessionId: string): void {
  spawnedSessions.add(sessionId);
}

/**
 * 세션에 대한 claude -p 프로세스가 없으면 새로 spawn한다.
 * 이미 살아있는 프로세스가 있으면 아무 것도 하지 않는다.
 */
export async function ensureClaudeProcess(
  connections: ConnectionManager,
  connectionId: string,
  workingDir: string,
  targetSessionId: string,
  inputMode: string,
  bridge: Bridge,
  model?: string,
): Promise<void> {
  // Standalone mode on Windows can't reach a WSL project's tooling: cmd.exe rejects
  // the UNC cwd and the CLI would use PowerShell instead of bash. Guide the user to
  // launch the GUI from inside their WSL shell. (JetBrains mode runs the backend
  // inside the distro, so platform is 'linux' there and this never trips.) Issue #57.
  if (process.platform === 'win32' && isWslUncPath(workingDir)) {
    const msg =
      'This project is inside WSL. On Windows, start the GUI from your WSL shell ' +
      '(run `ccg` in a WSL terminal) so Claude runs with bash and a Linux working ' +
      'directory instead of failing on the Windows UNC path.';
    console.error('[node-backend]', msg);
    connections.broadcastToSession(targetSessionId, MessageType.SERVICE_ERROR, {
      type: MessageType.WSL_HOST_MISMATCH,
      reason: msg,
      error: msg,
    });
    connections.broadcastToSession(targetSessionId, MessageType.STREAM_END);
    return;
  }

  const existingSession = connections.getSession(targetSessionId);
  if (existingSession?.process) {
    console.error(
      '[node-backend]',
      `Reusing existing process for session ${targetSessionId} (PID: ${existingSession.process.pid})`,
    );
    return;
  }

  const useResume = spawnedSessions.has(targetSessionId);
  const sessionFlag = useResume ? '--resume' : '--session-id';

  console.error('[node-backend]', `Starting Claude CLI process (-p interactive)...`);
  console.error('[node-backend]', `Working directory: ${workingDir}`);
  console.error('[node-backend]', `Session: ${targetSessionId} (${sessionFlag})`);

  const args = buildClaudeArgs(sessionFlag, targetSessionId, inputMode, model);

  console.error('[node-backend]', `Command: ${Claude.command} ${args.join(' ')}`);

  // Load this project's CLAUDE_CONFIG_DIR (project > global) onto process.env before
  // spawning, so the CLI resolves the right Claude data dir for THIS workingDir. (#123)
  await Claude.applyConfigDir(workingDir);

  // Strip OAuth env inherited from parent (e.g. Claude Desktop spawning the IDE) so the
  // CLI falls through to its keychain-based auth, which can refresh expired tokens.
  // User-pinned keys in Claude settings are preserved by getStrippableAuthEnvKeys().
  const stripKeys = await getStrippableAuthEnvKeys(workingDir);
  if (stripKeys.length > 0) {
    console.error('[node-backend]', `Stripping inherited auth env from CLI spawn: ${stripKeys.join(', ')}`);
  }
  const stripEnv: Record<string, undefined> = Object.fromEntries(
    stripKeys.map((k) => [k, undefined]),
  );

  const proc = Claude.spawn(args, {
    cwd: workingDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      TERM: 'dumb',
      CI: 'true',
      CLAUDECODE: undefined,
      ...stripEnv,
    },
  });

  let stderrBuffer = '';

  // spawn 완료까지 대기 (sendMessageToProcess가 안전하게 stdin write 가능하도록)
  await new Promise<void>((resolve, reject) => {
    proc.on('spawn', () => {
      console.error('[node-backend]', `Claude CLI spawned with PID: ${proc.pid}`);
      resolve();
    });
    proc.on('error', (err) => {
      console.error('[node-backend]', 'Failed to start Claude CLI:', err);
      // No trackError here: this rejects the awaited spawn promise, so it propagates
      // up through ensureClaudeProcess → sendMessageHandler → the ws-server handler
      // boundary, which reports it once via reportBackendError. Reporting here too
      // would double-count.
      connections.broadcastToSession(targetSessionId, MessageType.SERVICE_ERROR, {
        type: MessageType.SPAWN_ERROR,
        reason: err.message,
        error: err.message,
      });
      connections.broadcastToSession(targetSessionId, MessageType.STREAM_END);

      const session = connections.getSession(targetSessionId);
      if (session) {
        connections.setProcess(targetSessionId, null);
      }
      reject(err);
    });
  });

  // 성공적으로 spawn됨 → 다음 재시작 시 --resume 사용
  spawnedSessions.add(targetSessionId);

  // SessionRecord에 프로세스 저장
  connections.setProcess(targetSessionId, proc);
  connections.setBuffer(targetSessionId, '');

  // 모든 구독자에게 스트림 시작 알림
  connections.broadcastToSession(targetSessionId, MessageType.STREAM_START);

  proc.stdout?.on('data', (data: Buffer) => {
    // claude CLI stdout streaming runs outside the handleMessage flow, so the ws-server
    // handler boundary can't catch a throw here. Route any unexpected failure to the
    // single backend error reporting point so this async path converges with the rest.
    try {
      const chunk = data.toString();
      console.error('[node-backend]', `RAW stdout: ${chunk.trimEnd()}`);

      const currentBuffer = connections.getBuffer(targetSessionId);
      const newBuffer = currentBuffer + chunk;

      const lines = newBuffer.split('\n');
      connections.setBuffer(targetSessionId, lines.pop() ?? '');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line) as Record<string, unknown>;
          console.error('[node-backend]', `JSON event type: ${event.type}`);
          handleStreamEvent(targetSessionId, event, connections, bridge);
        } catch {
          // Non-JSON line is expected noise (not an error) in stream-json mode — only log.
          console.error('[node-backend]', `Non-JSON output (unexpected in stream-json mode): ${line}`);
        }
      }
    } catch (err) {
      reportBackendError(err instanceof Error ? err : new Error(String(err)), {
        layer: 'claude_stream',
        phase: 'stdout',
      });
    }
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const text = data.toString();
    console.error('[node-backend]', `Claude CLI stderr: ${text}`);
    stderrBuffer += text;
  });

  proc.on('close', (code) => {
    // Like the stdout handler, this close callback fires outside the handleMessage flow;
    // converge any unexpected throw at the single backend error reporting point.
    try {
      console.error('[node-backend]', `Claude CLI process exited with code: ${code}`);

      // 남은 버퍼 처리
      const remainingBuffer = connections.getBuffer(targetSessionId);
      if (remainingBuffer.trim()) {
        try {
          const event = JSON.parse(remainingBuffer) as Record<string, unknown>;
          handleStreamEvent(targetSessionId, event, connections, bridge);
        } catch {
          console.error('[node-backend]', `Remaining buffer (non-JSON): ${remainingBuffer}`);
        }
        connections.setBuffer(targetSessionId, '');
      }

      // "already in use" 에러 감지 → spawnedSessions에 추가 (다음 시도에서 --resume 사용)
      // 이 경우는 백엔드 콜드스타트 시 기존 세션에 접근할 때 발생
      if (code !== 0 && stderrBuffer.includes('already in use')) {
        spawnedSessions.add(targetSessionId);
      }

      // 비정상 종료 + result 미수신 → 에러 전파
      if (code !== 0 && !sessionsWithResult.has(targetSessionId)) {
        const errorMessage = stderrBuffer.trim() || `Claude CLI exited with code ${code}`;
        connections.broadcastToSession(targetSessionId, MessageType.SERVICE_ERROR, {
          type: MessageType.CLI_EXIT_ERROR,
          reason: errorMessage,
          error: errorMessage,
          exitCode: code,
        });
        // 인증 에러 진단
        diagnoseAuthError(targetSessionId, errorMessage, connections).catch(() => {});
      }

      // 추적 정리
      sessionsWithResult.delete(targetSessionId);
      workflowTracker?.stopSession(targetSessionId);

      connections.broadcastToSession(targetSessionId, MessageType.STREAM_END);

      // 프로세스 참조만 해제 (세션 레코드는 유지 — 구독자가 아직 있을 수 있음)
      connections.setProcess(targetSessionId, null);
    } catch (err) {
      reportBackendError(err instanceof Error ? err : new Error(String(err)), {
        layer: 'claude_stream',
        phase: 'close',
      });
    }
  });
}

/**
 * 기존 프로세스의 stdin에 JSON 메시지를 write한다.
 * 프로세스가 없거나 stdin이 쓸 수 없으면 false를 반환한다.
 */
export function sendMessageToProcess(
  connections: ConnectionManager,
  sessionId: string,
  content: string,
  attachments?: Array<
    | { type: 'image'; fileName: string; mimeType: string; base64: string }
    | { type: 'file'; fileName: string; absolutePath: string }
    | { type: 'folder'; folderName: string; absolutePath: string }
  >,
): boolean {
  const session = connections.getSession(sessionId);
  if (!session?.process?.stdin?.writable) {
    console.error('[node-backend]', `No writable stdin for session: ${sessionId}`);
    return false;
  }

  // 파일/폴더 경로를 프롬프트 앞에 삽입
  const fileRefs = attachments?.filter(a => a.type !== 'image') ?? [];
  let finalContent = content;
  if (fileRefs.length > 0) {
    const pathLines = fileRefs.map(r => (r as { absolutePath: string }).absolutePath).join('\n');
    finalContent = `${pathLines}\n\n${content}`;
  }

  // 이미지만 image block으로 변환
  const imageAtts = attachments?.filter(a => a.type === 'image') ?? [];

  let messageContent: string | Array<Record<string, unknown>>;
  if (imageAtts.length > 0) {
    const blocks: Array<Record<string, unknown>> = [];
    if (finalContent) {
      blocks.push({ type: 'text', text: finalContent });
    }
    for (const att of imageAtts) {
      if (att.type === 'image') {
        blocks.push({
          type: 'image',
          source: { type: 'base64', media_type: att.mimeType, data: att.base64 },
        });
      }
    }
    messageContent = blocks;
  } else {
    messageContent = finalContent;
  }

  const stdinMessage =
    JSON.stringify({
      type: 'user',
      message: { role: 'user', content: messageContent },
    }) + '\n';

  // Truncate log to avoid flooding with base64 data
  const logPreview = stdinMessage.length > 200
    ? stdinMessage.substring(0, 200) + `... (${stdinMessage.length} bytes total)`
    : stdinMessage.trimEnd();
  console.error('[node-backend]', `Sending to stdin: ${logPreview}`);
  session.process.stdin.write(stdinMessage);
  return true;
}

/**
 * CLI에 interrupt control_request를 보낸다.
 * SIGTERM 대신 stdin을 통해 graceful하게 현재 생성을 중단시킨다.
 * CLI는 interrupt를 받으면 현재 턴을 중단하고, stdin 버퍼에 대기 중인 다음 메시지를 처리한다.
 */
export function sendInterruptToProcess(
  connections: ConnectionManager,
  sessionId: string,
): boolean {
  const session = connections.getSession(sessionId);
  if (!session?.process?.stdin?.writable) {
    console.error('[node-backend]', `No writable stdin for session: ${sessionId}`);
    return false;
  }

  const requestId = Math.random().toString(36).substring(2, 15);
  const stdinMessage =
    JSON.stringify({
      type: 'control_request',
      request_id: requestId,
      request: { subtype: 'interrupt' },
    }) + '\n';

  console.error('[node-backend]', `Sending interrupt to stdin: ${stdinMessage.trimEnd()}`);
  session.process.stdin.write(stdinMessage);
  return true;
}

/**
 * tool_result를 CLI stdin에 전송한다.
 * 일반 user message와 달리 content를 tool_result 블록 배열로 구성한다.
 */
export function sendToolResultToProcess(
  connections: ConnectionManager,
  sessionId: string,
  toolResult: { type: string; tool_use_id: string; content: string; is_error: boolean },
): boolean {
  const session = connections.getSession(sessionId);
  if (!session?.process?.stdin?.writable) {
    console.error('[node-backend]', `No writable stdin for session: ${sessionId}`);
    return false;
  }

  const stdinMessage =
    JSON.stringify({
      type: 'user',
      message: { role: 'user', content: [toolResult] },
    }) + '\n';

  const logPreview = stdinMessage.length > 200
    ? stdinMessage.substring(0, 200) + `... (${stdinMessage.length} bytes total)`
    : stdinMessage.trimEnd();
  console.error('[node-backend]', `Sending tool_result to stdin: ${logPreview}`);
  session.process.stdin.write(stdinMessage);
  return true;
}

/**
 * set_model control_request를 CLI stdin에 전송한다.
 * 세션 레벨 모델 변경용 (프로세스 라이프사이클 동안만 유효).
 */
export function sendSetModelToProcess(
  connections: ConnectionManager,
  sessionId: string,
  model: string,
): boolean {
  const session = connections.getSession(sessionId);
  if (!session?.process?.stdin?.writable) {
    console.error('[node-backend]', `No writable stdin for session: ${sessionId}`);
    return false;
  }

  const stdinMessage =
    JSON.stringify({
      type: 'control_request',
      request_id: `set_model_${Date.now()}`,
      request: { subtype: 'set_model', model },
    }) + '\n';

  console.error('[node-backend]', `Sending set_model "${model}" to stdin`);
  session.process.stdin.write(stdinMessage);
  return true;
}

/**
 * control_response를 CLI stdin에 전송한다.
 * AskUserQuestion 등 control_request에 대한 응답용.
 */
export function sendControlResponseToProcess(
  connections: ConnectionManager,
  sessionId: string,
  response: Record<string, unknown>,
): boolean {
  const session = connections.getSession(sessionId);
  if (!session?.process?.stdin?.writable) {
    console.error('[node-backend]', `No writable stdin for session: ${sessionId}`);
    return false;
  }

  const stdinMessage =
    JSON.stringify({
      type: 'control_response',
      response,
    }) + '\n';

  const logPreview = stdinMessage.length > 200
    ? stdinMessage.substring(0, 200) + `... (${stdinMessage.length} bytes total)`
    : stdinMessage.trimEnd();
  console.error('[node-backend]', `Sending control_response to stdin: ${logPreview}`);
  session.process.stdin.write(stdinMessage);
  return true;
}

function handleStreamEvent(
  targetSessionId: string,
  event: Record<string, unknown>,
  connections: ConnectionManager,
  bridge: Bridge,
): void {
  const eventType = event.type as string;

  // Detect files Claude edited and, once each edit completes on disk, ask the
  // IDE to reload them (issue #72 — CLI writes bypass the IDE, and the native
  // file watcher misses changes on Windows). Record intents from assistant
  // events; emit refreshes when the matching tool_result succeeds.
  editedFileTracker.recordEdits(event);
  const pathsToRefresh = editedFileTracker.collectRefreshPaths(event);
  if (pathsToRefresh.length > 0) {
    bridge.refreshFiles({ paths: pathsToRefresh }).catch((err) => {
      console.error('[node-backend]', 'Failed to refresh files in IDE:', err);
    });
  }

  // Detect background dynamic workflows and stream their live progress. Pure
  // side-effect — the raw CLI event is still forwarded unchanged below.
  getWorkflowTracker(connections).handleEvent(targetSessionId, event);

  // 백엔드 고유 사이드이펙트 (WebView 전달과 무관한 서버 내부 로직)
  if (eventType === 'result') {
    sessionsWithResult.add(targetSessionId);
    connections.broadcastToAll(MessageType.SESSIONS_UPDATED, {
      action: 'upsert',
      session: {
        sessionId: event.session_id ?? targetSessionId,
      },
    });

    // 인증 에러 진단 (비동기, 실패해도 무시)
    const errorData = event.error as { message?: string } | null;
    if (errorData?.message) {
      diagnoseAuthError(targetSessionId, errorData.message, connections).catch(() => {});
    }
  }

  // 모든 CLI 이벤트를 있는 그대로 전달 — 타입별 분기/가공 없음
  connections.broadcastToSession(targetSessionId, MessageType.CLI_EVENT, event);
}
