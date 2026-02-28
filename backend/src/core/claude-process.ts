import { spawn } from 'child_process';
import type { ConnectionManager } from '../ws/connection-manager';

// InputMode -> CLI --permission-mode flag mapping
const INPUT_MODE_TO_CLI_FLAG: Record<string, string> = {
  plan: 'plan',
  bypass: 'bypassPermissions',
  ask_before_edit: 'default',
  auto_edit: 'acceptEdits',
};

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
  // connectionId를 이 세션에 구독
  connections.subscribe(connectionId, targetSessionId);

  const existingSession = connections.getSession(targetSessionId);
  if (existingSession?.process) {
    console.error(
      '[node-backend]',
      `Reusing existing process for session ${targetSessionId} (PID: ${existingSession.process.pid})`,
    );
    return;
  }

  console.error('[node-backend]', `Starting Claude CLI process (-p interactive)...`);
  console.error('[node-backend]', `Working directory: ${workingDir}`);
  console.error('[node-backend]', `Session: ${targetSessionId}`);

  const args: string[] = [
    '-p',
    '--output-format',
    'stream-json',
    '--input-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--session-id',
    targetSessionId,
  ];

  const cliFlag = INPUT_MODE_TO_CLI_FLAG[inputMode];
  if (cliFlag) {
    args.push('--permission-mode', cliFlag);
  }

  console.error('[node-backend]', `Command: claude ${args.join(' ')}`);

  const proc = spawn('claude', args, {
    cwd: workingDir,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      TERM: 'dumb',
      CI: 'true',
      PATH: process.env.PATH,
      CLAUDECODE: undefined,
    },
  });

  // spawn 완료까지 대기 (sendMessageToProcess가 안전하게 stdin write 가능하도록)
  await new Promise<void>((resolve, reject) => {
    proc.on('spawn', () => {
      console.error('[node-backend]', `Claude CLI spawned with PID: ${proc.pid}`);
      resolve();
    });
    proc.on('error', (err) => {
      console.error('[node-backend]', 'Failed to start Claude CLI:', err);
      connections.broadcastToSession(targetSessionId, 'SERVICE_ERROR', { error: err.message });
      connections.broadcastToSession(targetSessionId, 'STREAM_END');

      const session = connections.getSession(targetSessionId);
      if (session) {
        connections.setProcess(targetSessionId, null);
      }
      reject(err);
    });
  });

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
    console.error('[node-backend]', `Claude CLI stderr: ${data.toString()}`);
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
): boolean {
  const session = connections.getSession(sessionId);
  if (!session?.process?.stdin?.writable) {
    console.error('[node-backend]', `No writable stdin for session: ${sessionId}`);
    return false;
  }

  const stdinMessage =
    JSON.stringify({
      type: 'user',
      message: { role: 'user', content },
    }) + '\n';

  console.error('[node-backend]', `Sending to stdin: ${stdinMessage.trimEnd()}`);
  session.process.stdin.write(stdinMessage);
  return true;
}

function handleStreamEvent(
  targetSessionId: string,
  event: Record<string, unknown>,
  connections: ConnectionManager,
): void {
  // Claude CLI --output-format stream-json 이벤트 처리
  const eventType = event.type as string;

  switch (eventType) {
    case 'system':
      connections.broadcastToSession(targetSessionId, 'STREAM_EVENT', {
        eventType: 'system',
        subtype: event.subtype,
        sessionId: event.session_id,
        cwd: event.cwd,
        model: event.model,
      });
      break;

    case 'stream_event': {
      const innerEvent = event.event as Record<string, unknown>;
      if (!innerEvent) {
        console.error('[node-backend]', 'stream_event with no inner event, skipping');
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
        deltaData.content_block = innerEvent.content_block;
      }

      connections.broadcastToSession(targetSessionId, 'STREAM_EVENT', deltaData);
      break;
    }

    case 'assistant': {
      const message = event.message as Record<string, unknown> | undefined;
      connections.broadcastToSession(targetSessionId, 'ASSISTANT_MESSAGE', {
        messageId: message?.id,
        content: message?.content ?? [],
      });
      break;
    }

    case 'result': {
      const errorField = event.error as Record<string, unknown> | undefined;
      connections.broadcastToSession(targetSessionId, 'RESULT_MESSAGE', {
        status: event.subtype ?? event.status ?? 'unknown',
        isError: event.is_error ?? false,
        result: event.result ?? null,
        sessionId: event.session_id ?? null,
        error: errorField
          ? {
              code: errorField.code,
              message: errorField.message,
              details: errorField.details,
            }
          : null,
      });
      // 세션 목록 갱신 알림 (모든 탭)
      connections.broadcastToAll('SESSIONS_UPDATED', {
        action: 'upsert',
        session: {
          sessionId: event.session_id ?? targetSessionId,
        },
      });
      break;
    }

    default:
      console.error('[node-backend]', `Unknown CLI event type: ${eventType}`);
      break;
  }
}
