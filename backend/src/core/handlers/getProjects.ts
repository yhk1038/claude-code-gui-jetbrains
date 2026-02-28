import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { getProjectsList } from '../features/getProjectsList';

export async function getProjectsHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const projects = await getProjectsList();
  connections.sendTo(connectionId, 'PROJECTS_LIST', { projects });
  connections.sendTo(connectionId, 'ACK', { requestId: message.requestId });
}
