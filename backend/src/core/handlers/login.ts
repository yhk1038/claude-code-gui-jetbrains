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
    // Map the webview-selected login method to the CLI flag. The default
    // (`claude auth login` with no flag) is the Claude subscription flow, so an
    // unknown/missing method falls back to --claudeai. Previously the method was
    // dropped entirely, so "Anthropic Console" always ran the subscription flow.
    const method = message.payload?.method as string | undefined;
    const methodFlag = method === 'console' ? '--console' : '--claudeai';

    const child = Claude.spawn(['auth', 'login', methodFlag], {
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
