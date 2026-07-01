import { execFile as cpExecFile } from 'child_process';
import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { Claude } from '../claude';
import { augmentedEnv } from '../augmented-path';
import { getCliVersion } from './getVersion';
import { resolveClaudePaths } from './getCliUpdateInfo';
import { detectPackageManager, updateModeFor, buildUpdateCommand, detectHomebrewCask } from '../cli-update';
import { MessageType, UpdateMode } from '../../shared';

/**
 * Run the install-method-specific update command. Updates can take a while
 * (download + link), so allow a generous timeout. Combine stdout+stderr for a
 * useful error message on failure.
 */
function runUpdate(command: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    cpExecFile(
      command,
      args,
      {
        env: augmentedEnv(),
        timeout: 180000,
        maxBuffer: 10 * 1024 * 1024,
        // Windows launchers (npm.cmd, volta.exe wrappers) resolve via a shell,
        // mirroring Claude.exec's win32 path.
        shell: process.platform === 'win32',
      },
      (err, stdout, stderr) => {
        const output = `${stdout?.toString() ?? ''}${stderr?.toString() ?? ''}`.trim();
        resolve({ ok: !err, output });
      },
    );
  });
}

/**
 * UPDATE_CLI — update the Claude Code CLI in place using the command that
 * matches how it was installed (npm/pnpm/yarn/volta/native/homebrew/winget).
 *
 * VERSIONED installs update to `payload.version` (a concrete number resolved
 * from a dist-tag by the UI); SIMPLE installs update to the latest of their
 * channel and ignore the version. After the command succeeds we re-read
 * `claude --version` so the client can show/refresh the new version.
 */
export async function updateCliHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  try {
    const version = (message.payload as { version?: string })?.version ?? null;
    const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
    const paths = await resolveClaudePaths();
    const packageManager = detectPackageManager(paths, home);
    const updateMode = updateModeFor(packageManager);

    if (updateMode === UpdateMode.NONE) {
      throw new Error(`This install method (${packageManager}) has no automatic update path. Update it the way you installed it.`);
    }

    const spec = buildUpdateCommand(
      packageManager,
      updateMode === UpdateMode.VERSIONED ? version : null,
      detectHomebrewCask(paths),
    );
    if (!spec) {
      throw new Error(`Cannot build an update command for ${packageManager}.`);
    }

    // NATIVE's bare `claude` resolves to the configured/derived CLI binary.
    const command = spec.command === 'claude' ? Claude.command : spec.command;
    console.log('claude update exec\n', command, spec.args.join(' '), '\n');

    const { ok, output } = await runUpdate(command, spec.args);
    if (!ok) {
      throw new Error(output || 'Update command failed');
    }

    const newVersion = await getCliVersion();

    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'ok',
      newVersion,
    });
  } catch (err) {
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
