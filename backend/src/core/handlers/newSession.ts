import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';

export async function newSessionHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
): Promise<void> {
  connections.unsubscribe(connectionId);
  console.error('[node-backend]', 'Client unsubscribed, will create new session on next message');

  try {
    await bridge.newSession();
  } catch (err) {
    console.error('[node-backend]', 'bridge.newSession() failed:', err);
  }

  connections.sendTo(connectionId, 'ACK', { requestId: message.requestId });
}
