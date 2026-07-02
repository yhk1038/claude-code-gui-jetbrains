import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { MessageType } from '../../shared';

export async function openFileHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
): Promise<void> {
  const filePath = message.payload?.filePath as string;
  const line = message.payload?.line as number | undefined;
  const column = message.payload?.column as number | undefined;
  if (filePath) {
    try {
      await bridge.openFile(filePath, line, column);
    } catch (err) {
      console.error('[node-backend]', 'Failed to open file:', err);
    }
  }
  connections.sendTo(connectionId, MessageType.ACK, { requestId: message.requestId });
}
