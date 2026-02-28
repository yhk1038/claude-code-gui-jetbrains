import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';

export async function openSettingsHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
): Promise<void> {
  try {
    await bridge.openSettings();
  } catch (err) {
    console.error('[node-backend]', 'bridge.openSettings() failed:', err);
  }
  connections.sendTo(connectionId, 'ACK', { requestId: message.requestId });
}
