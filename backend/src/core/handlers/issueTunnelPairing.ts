import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { getTunnelStatus, validateTunnelStatus } from '../features/tunnel-manager';
import { tunnelPairing, buildPairingUrl } from '../features/tunnel-pairing';
import { MessageType } from '../../shared';

/**
 * Issue a fresh single-use pairing code for the running Remote-Control tunnel
 * and return the QR pairing URL (`<tunnel>/?pair=<code>`). The URL carries only
 * the short-lived code — never the auth token. Called by the tunnel modal each
 * time it needs a live QR (open, or after the previous code expired).
 *
 * The requesting webview is the LOCAL, already-authenticated operator, so
 * handing it the code is safe; the code is what the remote device then redeems
 * over the tunnel via POST /pair.
 */
export async function issueTunnelPairingHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  // Correct any stale restored-tunnel state before reading the URL.
  validateTunnelStatus();
  const status = getTunnelStatus();

  if (!status.enabled || !status.url) {
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'error',
      error: 'Tunnel is not running',
    });
    return;
  }

  const code = tunnelPairing.issueCode();
  const pairUrl = buildPairingUrl(status.url, code);
  // Never log the code or the URL (the URL embeds the code).
  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    status: 'ok',
    pairUrl,
  });
}
