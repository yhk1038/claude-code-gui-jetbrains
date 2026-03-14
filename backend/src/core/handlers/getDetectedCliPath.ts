import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { Claude } from '../claude';

export async function getDetectedCliPathHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const detectedPath = await Claude.which();

  connections.sendTo(connectionId, 'ACK', {
    requestId: message.requestId,
    path: detectedPath,
  });
}
