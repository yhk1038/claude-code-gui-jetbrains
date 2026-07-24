import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { fetchAnnouncements } from '../features/announcements';
import { getDismissedAnnouncementIds } from '../features/profile';
import { MessageType, type GetAnnouncementsResult } from '../../shared';

/**
 * Fetches the current locale's announcement list (backend-cached, remote delivery
 * endpoint — see features/announcements.ts) plus the ids the user already dismissed
 * (profile.json), and returns both as-is (no field editing/renaming) in the ACK.
 */
export async function getAnnouncementsHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const workingDir = typeof message.payload?.workingDir === 'string' ? message.payload.workingDir : undefined;

  const [response, dismissedIds] = await Promise.all([
    fetchAnnouncements(workingDir),
    getDismissedAnnouncementIds(),
  ]);

  const result: GetAnnouncementsResult = {
    schemaVersion: response.schemaVersion,
    announcements: response.announcements,
    dismissedIds,
  };

  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    status: 'ok',
    ...result,
  });
}
