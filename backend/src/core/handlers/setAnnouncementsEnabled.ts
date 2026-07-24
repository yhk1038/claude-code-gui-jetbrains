import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { setAnnouncementsEnabled } from '../features/profile';
import { MessageType } from '../../shared';

/**
 * 공지(Announcement) 수신 on/off를 profile.json에 영속화한다. off로 바뀌면 이후
 * fetchAnnouncements가 원격 요청 자체를 하지 않는다(announcements.ts의 게이팅).
 */
export async function setAnnouncementsEnabledHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const enabled = message.payload?.enabled === true;
  const profile = await setAnnouncementsEnabled(enabled);
  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    status: 'ok',
    enabled: profile.announcementsEnabled,
  });
}
