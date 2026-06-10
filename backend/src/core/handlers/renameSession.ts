import { existsSync } from 'fs';
import { basename, isAbsolute, relative, resolve } from 'path';
import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { getProjectSessionsPath } from '../features/getProjectSessionsPath';
import { writeSessionTitleOverride } from '../features/sessionTitleOverrides';

export async function renameSessionHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const sessionId = message.payload?.sessionId as string | undefined;
  const title = (message.payload?.title as string | undefined)?.trim();
  const workingDir = message.payload?.workingDir as string | undefined;

  if (!sessionId || !title || !workingDir) {
    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'error',
      error: 'sessionId, title, and workingDir are required',
    });
    return;
  }

  try {
    if (sessionId !== basename(sessionId) || sessionId.includes('..')) {
      connections.sendTo(connectionId, 'ACK', {
        requestId: message.requestId,
        status: 'error',
        error: 'Invalid sessionId',
      });
      return;
    }

    const sessionsDir = await getProjectSessionsPath(workingDir);
    const sessionFile = resolve(sessionsDir, `${sessionId}.jsonl`);
    const relativeSessionFile = relative(resolve(sessionsDir), sessionFile);
    if (relativeSessionFile.startsWith('..') || isAbsolute(relativeSessionFile) || !existsSync(sessionFile)) {
      connections.sendTo(connectionId, 'ACK', {
        requestId: message.requestId,
        status: 'error',
        error: 'Session not found',
      });
      return;
    }

    await writeSessionTitleOverride(sessionsDir, sessionId, title);

    connections.broadcastToAll('SESSIONS_UPDATED', {
      action: 'rename',
      session: { sessionId, title },
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
