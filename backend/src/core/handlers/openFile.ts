import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';

export async function openFileHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
): Promise<void> {
  const filePath = message.payload?.filePath as string;
  if (filePath) {
    try {
      await bridge.openFile(filePath);
    } catch (err) {
      console.error('[node-backend]', 'Failed to open file:', err);
    }
  }
  connections.sendTo(connectionId, 'ACK', { requestId: message.requestId });
}
