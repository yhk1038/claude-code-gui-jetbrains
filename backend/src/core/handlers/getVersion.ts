import { exec } from 'child_process';
import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { getAugmentedPath } from '../claude-process';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import { isDev } from '../../config/environment';

declare const __PLUGIN_VERSION__: string;

function getPluginVersion(): string {
  if (isDev()) {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const pkgPath = resolve(currentDir, '../../..', 'package.json');
    return JSON.parse(readFileSync(pkgPath, 'utf-8')).version;
  }
  return __PLUGIN_VERSION__;
}

function getCliVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    exec('claude --version', { timeout: 5000, env: { ...process.env, PATH: getAugmentedPath() } }, (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      const raw = stdout.trim();
      const match = raw.match(/^[\d.]+/);
      resolve(match ? match[0] : raw);
    });
  });
}

export async function getVersionHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
): Promise<void> {
  try {
    const [cliVersion, requiresRestart] = await Promise.all([
      getCliVersion(),
      bridge.requiresRestart().catch(() => true),
    ]);
    const pluginVersion = getPluginVersion();

    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'ok',
      pluginVersion,
      cliVersion,
      requiresRestart,
    });
  } catch (err) {
    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
