import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { installCloudflared } from '../features/tunnel-manager';

/**
 * Explicitly install cloudflared after the user consented in the UI. ACK
 * immediately (installation can take minutes — well past the request timeout)
 * and report the outcome via a CLOUDFLARED_INSTALL_STATUS broadcast so the UI
 * can proceed to start the tunnel, or show an error.
 */
export async function installCloudflaredHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  connections.sendTo(connectionId, 'ACK', {
    requestId: message.requestId,
    status: 'ok',
  });

  try {
    await installCloudflared();
    connections.broadcastToAll('CLOUDFLARED_INSTALL_STATUS', { status: 'installed' });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    connections.broadcastToAll('CLOUDFLARED_INSTALL_STATUS', { status: 'failed', error });
  }
}
