import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { getSessionsList } from '../features/getSessionsList';

export async function getSessionsHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const workingDir = (message.payload?.workingDir as string) || process.cwd();
  const sessions = await getSessionsList(workingDir);
  connections.sendTo(connectionId, 'ACK', { requestId: message.requestId, sessions });
}
