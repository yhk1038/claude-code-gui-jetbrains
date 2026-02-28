import { unlink } from 'fs/promises';
import { join } from 'path';
import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { getProjectSessionsPath } from '../features/getProjectSessionsPath';

export async function deleteSessionHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const sessionId = message.payload?.sessionId as string | undefined;

  if (!sessionId) {
    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'error',
      error: 'Missing sessionId',
    });
    return;
  }

  try {
    const sessionsDir = await getProjectSessionsPath(
      (message.payload?.workingDir as string) || process.cwd(),
    );
    const sessionFile = join(sessionsDir, `${sessionId}.jsonl`);
    await unlink(sessionFile);

    connections.broadcastToAll('SESSIONS_UPDATED', {
      action: 'delete',
      session: { sessionId },
    });

    connections.sendTo(connectionId, 'ACK', { requestId: message.requestId, status: 'ok' });
  } catch (err) {
    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
