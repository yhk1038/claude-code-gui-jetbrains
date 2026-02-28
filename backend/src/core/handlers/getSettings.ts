import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { readSettingsFile } from '../features/settings';

export async function getSettingsHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const settings = await readSettingsFile();
  connections.sendTo(connectionId, 'ACK', {
    requestId: message.requestId,
    status: 'ok',
    settings,
  });
}
