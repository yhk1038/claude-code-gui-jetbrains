import { execFile as cpExecFile } from 'child_process';
import { realpathSync } from 'fs';
import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { Claude } from '../claude';
import { augmentedEnv } from '../augmented-path';
import { getCliVersion } from './getVersion';
import {
  detectPackageManager,
  updateModeFor,
  isCliUpdatable,
  parseDistTags,
  CLAUDE_NPM_PACKAGE,
} from '../cli-update';
import { MessageType, PackageManager, UpdateMode, type CliUpdateInfo } from '../../shared';

/**
 * Query npm's registry for the available dist-tag versions. The backend runs on
 * the user's machine, so node/npm exist; `npm view` is an official read command
 * (project philosophy: prefer documented CLI over private protocols).
 */
async function fetchDistTags(): Promise<{ stable: string | null; latest: string | null }> {
  return new Promise((resolve) => {
    cpExecFile(
      'npm',
      ['view', CLAUDE_NPM_PACKAGE, 'dist-tags', '--json'],
      {
        env: augmentedEnv(),
        timeout: 15000,
        // npm is npm.cmd on Windows → needs a shell to resolve, like Claude.exec.
        shell: process.platform === 'win32',
      },
      (err, stdout) => {
        if (err) {
          resolve({ stable: null, latest: null });
          return;
        }
        resolve(parseDistTags(stdout?.toString() ?? ''));
      },
    );
  });
}

/** Resolve every path we know for the running `claude` binary (shim + realpath). */
export async function resolveClaudePaths(): Promise<Array<string | null>> {
  const whichPath = await Claude.which();
  let realPath: string | null = null;
  if (whichPath) {
    try {
      realPath = realpathSync(whichPath);
    } catch {
      realPath = null;
    }
  }
  return [whichPath, realPath];
}

export async function getCliUpdateInfoHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  try {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
    const paths = await resolveClaudePaths();
    const packageManager = detectPackageManager(paths, home);
    const updateMode = updateModeFor(packageManager);

    // Skip the registry round-trip when nothing is updatable anyway.
    const [cliVersion, tags] = await Promise.all([
      getCliVersion(),
      updateMode === UpdateMode.NONE
        ? Promise.resolve({ stable: null, latest: null })
        : fetchDistTags(),
    ]);

    const info: CliUpdateInfo = {
      cliVersion,
      packageManager,
      updateMode,
      stable: tags.stable,
      latest: tags.latest,
      updatable: isCliUpdatable(updateMode, cliVersion, tags.latest),
    };

    console.log('claude update info\n', JSON.stringify({ ...info, paths }), '\n');

    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'ok',
      ...info,
    });
  } catch (err) {
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'error',
      packageManager: PackageManager.UNKNOWN,
      updateMode: UpdateMode.NONE,
      updatable: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
