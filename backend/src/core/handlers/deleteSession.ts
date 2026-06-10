import { unlink } from 'fs/promises';
import { resolve, basename, relative, isAbsolute } from 'path';
import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { getProjectSessionsPath } from '../features/getProjectSessionsPath';
import { removeSessionTitleOverride } from '../features/sessionTitleOverrides';

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
    // Validate sessionId to prevent path traversal (must be a simple filename component)
    if (sessionId !== basename(sessionId) || sessionId.includes('..')) {
      connections.sendTo(connectionId, 'ACK', {
        requestId: message.requestId,
        status: 'error',
        error: 'Invalid sessionId',
      });
      return;
    }

    const workingDir = message.payload?.workingDir as string | undefined;
    if (!workingDir) {
      connections.sendTo(connectionId, 'ACK', {
        requestId: message.requestId,
        status: 'error',
        error: 'workingDir is required',
      });
      return;
    }

    const sessionsDir = await getProjectSessionsPath(workingDir);
    const sessionFile = resolve(sessionsDir, `${sessionId}.jsonl`);

    // Ensure the resolved path stays within sessionsDir. Compare via path.relative
    // rather than a hardcoded "/" separator so the check holds on Windows too
    // (matches the guard in renameSession).
    const relativeSessionFile = relative(resolve(sessionsDir), sessionFile);
    if (relativeSessionFile.startsWith('..') || isAbsolute(relativeSessionFile)) {
      connections.sendTo(connectionId, 'ACK', {
        requestId: message.requestId,
        status: 'error',
        error: 'Invalid sessionId',
      });
      return;
    }

    await unlink(sessionFile);

    // Drop any stored title override so a future session reusing this id does not
    // inherit a stale custom title.
    await removeSessionTitleOverride(sessionsDir, sessionId);

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
