import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { getAnnouncementsEnabled } from '../features/profile';
import { MessageType } from '../../shared';

/** 현재 공지(Announcement) 수신 설정을 반환한다(기본값 true). */
export async function getAnnouncementsEnabledHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const enabled = await getAnnouncementsEnabled();
  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    status: 'ok',
    enabled,
  });
}
