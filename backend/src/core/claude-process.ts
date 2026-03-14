import type { ConnectionManager } from '../ws/connection-manager';
import { Claude } from './claude';

// InputMode -> CLI --permission-mode flag mapping
const INPUT_MODE_TO_CLI_FLAG: Record<string, string> = {
  plan: 'plan',
  bypass: 'bypassPermissions',
  ask_before_edit: 'default',
  auto_edit: 'acceptEdits',
};

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
): Promise<void> {
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

  console.error('[node-backend]', `Command: ${Claude.command} ${args.join(' ')}`);

  const proc = Claude.spawn(args, {
    cwd: workingDir,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      TERM: 'dumb',
      CI: 'true',
      CLAUDECODE: undefined,
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
      connections.broadcastToSession(targetSessionId, 'SERVICE_ERROR', {
        type: 'SPAWN_ERROR',
        reason: err.message,
        error: err.message,
      });
      connections.broadcastToSession(targetSessionId, 'STREAM_END');

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
  connections.broadcastToSession(targetSessionId, 'STREAM_START');

  proc.stdout?.on('data', (data: Buffer) => {
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
        handleStreamEvent(targetSessionId, event, connections);
      } catch {
        console.error('[node-backend]', `Non-JSON output (unexpected in stream-json mode): ${line}`);
      }
    }
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const text = data.toString();
    console.error('[node-backend]', `Claude CLI stderr: ${text}`);
    stderrBuffer += text;
  });

  proc.on('close', (code) => {
    console.error('[node-backend]', `Claude CLI process exited with code: ${code}`);

    // 남은 버퍼 처리
    const remainingBuffer = connections.getBuffer(targetSessionId);
    if (remainingBuffer.trim()) {
      try {
        const event = JSON.parse(remainingBuffer) as Record<string, unknown>;
        handleStreamEvent(targetSessionId, event, connections);
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
      connections.broadcastToSession(targetSessionId, 'SERVICE_ERROR', {
        type: 'CLI_EXIT_ERROR',
        reason: errorMessage,
        error: errorMessage,
        exitCode: code,
      });
    }

    // 추적 정리
    sessionsWithResult.delete(targetSessionId);

    connections.broadcastToSession(targetSessionId, 'STREAM_END');

    // 프로세스 참조만 해제 (세션 레코드는 유지 — 구독자가 아직 있을 수 있음)
    connections.setProcess(targetSessionId, null);
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
): void {
  const eventType = event.type as string;

  // 백엔드 고유 사이드이펙트 (WebView 전달과 무관한 서버 내부 로직)
  if (eventType === 'result') {
    sessionsWithResult.add(targetSessionId);
    connections.broadcastToAll('SESSIONS_UPDATED', {
      action: 'upsert',
      session: {
        sessionId: event.session_id ?? targetSessionId,
      },
    });
  }

  // 모든 CLI 이벤트를 있는 그대로 전달 — 타입별 분기/가공 없음
  connections.broadcastToSession(targetSessionId, 'CLI_EVENT', event);
}
