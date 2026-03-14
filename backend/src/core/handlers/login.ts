import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { Claude } from '../claude';

export function loginHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  return new Promise((resolve) => {
    const child = Claude.spawn(['auth', 'login'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.on('close', (code) => {
      connections.sendTo(connectionId, 'ACK', {
        requestId: message.requestId,
        status: code === 0 ? 'ok' : 'error',
        ...(code !== 0 && { error: 'Login failed or cancelled' }),
      });
      resolve();
    });

    child.on('error', (err) => {
      connections.sendTo(connectionId, 'ACK', {
        requestId: message.requestId,
        status: 'error',
        error: err.message,
      });
      resolve();
    });
  });
}
