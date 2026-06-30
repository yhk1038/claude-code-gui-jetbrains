import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { loadSessionMessages } from '../features/loadSessionMessages';
import { reconstructWorkflowTasks } from '../features/workflow-tracker';
import { markSessionAsSpawned, isWorkflowRunning } from '../claude-process';
import { MessageType } from '../../shared';

export async function loadSessionHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const workingDir = message.payload?.workingDir as string | undefined;
  const sessionId = message.payload?.sessionId as string;

  if (!workingDir) {
    connections.sendTo(connectionId, MessageType.ERROR, {
      requestId: message.requestId,
      error: 'workingDir is required',
    });
    return;
  }

  if (sessionId) {
    // 기존 세션 로딩 → 다음 spawn 시 --resume 사용하도록 마킹
    markSessionAsSpawned(sessionId);
    connections.subscribe(connectionId, sessionId);
    
    const beforeUuid = message.payload?.beforeUuid as string | undefined;
    const limit = message.payload?.limit as number | undefined;
    const isOlderPage = message.type === MessageType.LOAD_OLDER_MESSAGES;

    const result = await loadSessionMessages(workingDir, sessionId, beforeUuid, limit);
    connections.sendTo(connectionId, MessageType.SESSION_LOADED, {
      sessionId,
      messages: result.messages,
      hasMore: result.hasMore,
      oldestUuid: result.oldestUuid,
      prepend: isOlderPage,
    });

    // Rebuild background-workflow state from the transcript so the inline cards
    // and the Background tasks panel populate on reload (the live progress
    // stream is not replayed). Best-effort — never blocks the session load.
    // Only on the initial load — older pages would re-run it per page and could
    // re-emit already-reconstructed tasks.
    if (!isOlderPage) {
      try {
        const workflows = await reconstructWorkflowTasks(
          result.messages as Array<Record<string, unknown>>,
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
    }
  }
  connections.sendTo(connectionId, MessageType.ACK, { requestId: message.requestId });
}
