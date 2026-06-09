import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';

export async function getIdeRootHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
): Promise<void> {
  const workingDir =
    typeof message.payload?.['workingDir'] === 'string'
      ? (message.payload['workingDir'] as string)
      : undefined;

  let ideRoot: string | null = null;
  try {
    ideRoot = await bridge.getIdeRoot(workingDir);
  } catch (err) {
    console.error('[node-backend]', 'getIdeRoot failed:', err);
    ideRoot = null;
  }

  connections.sendTo(connectionId, 'IDE_ROOT', { ideRoot });
  connections.sendTo(connectionId, 'ACK', { requestId: message.requestId });
}
