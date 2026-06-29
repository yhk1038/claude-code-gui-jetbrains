import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { MessageType } from '../../shared';
import { deleteAccount } from '../features/account-manager';
import { resetUsageCache } from './getUsage';
import { resetAllUsageCache } from './getAllUsage';

/**
 * DELETE_ACCOUNT — remove a saved account (snapshot + registry entry) by id.
 * Does not touch the live credentials. Broadcasts ACCOUNTS_CHANGED.
 */
export async function deleteAccountHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const id = (message.payload as { id?: string })?.id;
  if (!id) {
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'error',
      error: 'Missing account id.',
    });
    return;
  }
  try {
    await deleteAccount(id);
    resetUsageCache();
    resetAllUsageCache();
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'ok',
    });
    connections.broadcastToAll(MessageType.ACCOUNTS_CHANGED, {});
  } catch (err) {
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
