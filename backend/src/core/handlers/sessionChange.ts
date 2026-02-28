import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';

export function sessionChangeHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): void {
  const sessionId = message.payload?.sessionId as string | undefined;
  if (sessionId) {
    connections.subscribe(connectionId, sessionId);
  }
  connections.sendTo(connectionId, 'ACK', { requestId: message.requestId });
}
