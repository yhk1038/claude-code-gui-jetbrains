import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { loadSessionMessages } from '../features/loadSessionMessages';
import { reconstructWorkflowTasks } from '../features/workflow-tracker';
import { markSessionAsSpawned, isWorkflowRunning } from '../claude-process';
import { MessageType } from '../../shared';

export async function reclaimSessionHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const sessionId = message.payload?.sessionId as string;
  const workingDir = message.payload?.workingDir as string | undefined;

  if (!sessionId) {
    connections.sendTo(connectionId, MessageType.ACK, { requestId: message.requestId });
    return;
  }

  if (!workingDir) {
    connections.sendTo(connectionId, MessageType.ERROR, {
      requestId: message.requestId,
      error: 'workingDir is required',
    });
    return;
  }

  console.error('[node-backend]', `Reclaiming session: ${sessionId}`);

  // 1. 내부 프로세스 종료
  const session = connections.getSession(sessionId);
  if (session?.process) {
    console.error('[node-backend]', `Killing internal process for session ${sessionId}`);
    session.process.kill('SIGTERM');
    connections.setProcess(sessionId, null);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 2. 다음 spawn 시 --resume 사용하도록 마킹
  markSessionAsSpawned(sessionId);

  // 3. 세션 메시지 로딩 & 전송
  connections.subscribe(connectionId, sessionId);
  const messages = await loadSessionMessages(workingDir, sessionId);
  connections.sendTo(connectionId, MessageType.SESSION_LOADED, {
    sessionId,
    messages,
  });

  // Rebuild background-workflow state from the transcript (see loadSession).
  try {
    const workflows = await reconstructWorkflowTasks(
      messages as Array<Record<string, unknown>>,
      (toolUseId) => isWorkflowRunning(sessionId, toolUseId),
    );
    for (const task of workflows) {
      connections.sendTo(
        connectionId,
        MessageType.WORKFLOW_PROGRESS,
        task as unknown as Record<string, unknown>,
      );
    }
  } catch (err) {
    console.error('[node-backend]', 'workflow reconstruction failed:', err);
  }

  console.error('[node-backend]', `Session ${sessionId} reclaimed successfully`);
  connections.sendTo(connectionId, MessageType.ACK, { requestId: message.requestId });
}
