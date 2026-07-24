import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { setDismissedAnnouncement } from '../features/profile';
import { MessageType } from '../../shared';

/** Persists a `{ id }` dismissal to profile.json and returns the updated dismissedIds. */
export async function dismissAnnouncementHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const id = message.payload?.id;
  if (typeof id !== 'string' || id.length === 0) {
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'error',
      error: 'id is required',
    });
    return;
  }

  const dismissedIds = await setDismissedAnnouncement(id);
  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    status: 'ok',
    dismissedIds,
  });
}
