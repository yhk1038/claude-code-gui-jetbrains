import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';

export function stopSessionHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): void {
  const client = connections.getClient(connectionId);
  if (client?.subscribedSessionId) {
    const session = connections.getSession(client.subscribedSessionId);
    if (session?.process) {
      console.error('[node-backend]', `Stopping session process for ${client.subscribedSessionId}`);
      session.process.kill('SIGTERM');
      // process = null is handled in the close event
    }
  }
  connections.sendTo(connectionId, 'ACK', { requestId: message.requestId });
}
