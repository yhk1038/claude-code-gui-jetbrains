import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';

/**
 * Report the `node` executable currently running this backend.
 *
 * The backend was spawned by the IDE (Kotlin NodeProcessManager) using whatever
 * node it resolved, so `process.execPath` is the exact binary in use — the most
 * accurate "detected" value to show as a placeholder in the settings UI.
 *
 * Counterpart to GET_DETECTED_CLI_PATH, which asks the shell for `which claude`.
 * For node we don't need to search: we already are that process.
 */
export async function getDetectedNodePathHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  connections.sendTo(connectionId, 'ACK', {
    requestId: message.requestId,
    path: process.execPath || null,
  });
}
