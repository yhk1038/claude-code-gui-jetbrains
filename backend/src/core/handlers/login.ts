import { spawn } from 'child_process';
import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { readSettingsFile } from '../features/settings';

export async function loginHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const settings = await readSettingsFile();
  const claudeCmd = (settings.cliPath as string) || 'claude';

  return new Promise((resolve) => {
    const child = spawn(claudeCmd, ['auth', 'login'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
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
