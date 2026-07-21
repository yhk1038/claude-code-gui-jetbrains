import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { MessageType } from '../../shared';
import { ccbInstallHint } from '../ccb-install-hint';

/**
 * GET_CCB_INSTALL_HINT — the platform-correct install command + shells for the
 * "not installed" notice, so a user copying the command by hand knows exactly
 * what to paste and where. Backend-owned because the right command depends on
 * the OS the backend actually runs on (win32 needs npm.cmd, unix plain npm).
 */
export async function getCcbInstallHintHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const hint = ccbInstallHint();
  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    status: 'ok',
    ...hint,
  });
}
