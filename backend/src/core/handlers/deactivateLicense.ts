import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { clearLicense } from '../features/license';
import { MessageType } from '../../shared';

/** Remove the stored sponsor license (turn sponsorship off on this install). */
export async function deactivateLicenseHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  await clearLicense();
  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    status: 'ok',
    isSponsor: false,
  });
}
