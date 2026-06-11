import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { isCloudflaredAvailable } from '../features/tunnel-manager';

/**
 * Report whether the tunnel's prerequisites are met (currently: cloudflared is
 * locatable without installing). The UI calls this when the tunnel modal opens
 * so it can warn the user before they toggle the tunnel on.
 */
export async function getTunnelPrereqsHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const cloudflaredAvailable = await isCloudflaredAvailable();
  connections.sendTo(connectionId, 'ACK', {
    requestId: message.requestId,
    status: 'ok',
    cloudflaredAvailable,
  });
}
