import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { startTunnel, getTunnelStatus } from '../features/tunnel-manager';
import { serverPort } from '../../config/environment';

export async function tunnelStartHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const port = typeof message.payload?.port === 'number' ? message.payload.port : serverPort;

  // ACK immediately so the frontend doesn't hit the 30s Bridge timeout
  connections.sendTo(connectionId, 'ACK', {
    requestId: message.requestId,
    status: 'ok',
  });

  // Run tunnel creation in background; deliver result via broadcast
  startTunnel(port)
    .then((tunnelUrl) => {
      // Guard: tunnel may have been stopped while waiting for readiness
      const status = getTunnelStatus();
      if (status.enabled && status.url) {
        connections.broadcastToAll('TUNNEL_STATUS', { enabled: true, url: tunnelUrl });
      }
    })
    .catch((err) => {
      // Guard: don't broadcast error if tunnel was intentionally stopped
      const status = getTunnelStatus();
      if (status.url !== null) return;
      const error = err instanceof Error ? err.message : String(err);
      connections.broadcastToAll('TUNNEL_STATUS', { enabled: false, url: null, error });
    });
}
