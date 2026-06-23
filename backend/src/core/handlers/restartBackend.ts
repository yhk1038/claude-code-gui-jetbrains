import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { RESTART_EXIT_CODE } from '../../config/environment';

export function restartBackendHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): void {
  // Send ACK first so the webview's request resolves before the socket closes
  connections.sendTo(connectionId, 'ACK', { requestId: message.requestId });

  // Exit after a short delay to allow the ACK frame to flush
  setTimeout(() => process.exit(RESTART_EXIT_CODE), 300);
}
