import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';

export async function openDiffHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
): Promise<void> {
  const filePath = message.payload?.filePath as string;
  const oldContent = message.payload?.oldContent as string;
  const newContent = message.payload?.newContent as string;
  const toolUseId = message.payload?.toolUseId as string | undefined;

  try {
    await bridge.openDiff({ filePath, oldContent, newContent, toolUseId });
    connections.sendTo(connectionId, 'ACK', { requestId: message.requestId, status: 'ok' });
  } catch (err) {
    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
