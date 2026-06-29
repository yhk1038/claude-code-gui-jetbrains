import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { MessageType } from '../../shared';
import { saveCurrentAccount } from '../features/account-manager';
import { resetUsageCache } from './getUsage';
import { resetAllUsageCache } from './getAllUsage';

/**
 * SAVE_ACCOUNT — capture the currently logged-in Claude account into the saved
 * registry. Broadcasts ACCOUNTS_CHANGED so every window refreshes its list.
 */
export async function saveAccountHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  try {
    const account = await saveCurrentAccount();
    resetUsageCache();
    resetAllUsageCache();
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'ok',
      account,
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
