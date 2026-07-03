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
  // Validate at runtime rather than asserting: a non-number line/column (a caller
  // slip) must not flow downstream to the IDE as a bogus coordinate.
  const rawLine = message.payload?.line;
  const rawColumn = message.payload?.column;
  const line = typeof rawLine === 'number' ? rawLine : undefined;
  const column = typeof rawColumn === 'number' ? rawColumn : undefined;
  if (filePath) {
    try {
      await bridge.openFile(filePath, line, column);
    } catch (err) {
      console.error('[node-backend]', 'Failed to open file:', err);
    }
  }
  connections.sendTo(connectionId, MessageType.ACK, { requestId: message.requestId });
}
