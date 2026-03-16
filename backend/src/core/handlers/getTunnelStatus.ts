import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { getTunnelStatus, validateTunnelStatus } from '../features/tunnel-manager';
import { getSleepGuardStatus } from '../features/sleep-guard';

export async function getTunnelStatusHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  try {
    // Detect stale state (e.g. restored process that died)
    const stateChanged = validateTunnelStatus();

    const tunnel = getTunnelStatus();
    const sleepGuard = getSleepGuardStatus();
    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'ok',
      tunnel,
      sleepGuard,
    });

    // Broadcast corrected status so all subscribers (e.g. TunnelButton) update
    if (stateChanged) {
      connections.broadcastToAll('TUNNEL_STATUS', { enabled: tunnel.enabled, url: tunnel.url });
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'error',
      error,
    });
  }
}
