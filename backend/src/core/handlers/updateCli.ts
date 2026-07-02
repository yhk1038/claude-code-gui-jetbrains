import { execFile as cpExecFile } from 'child_process';
import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { Claude } from '../claude';
import { augmentedEnv } from '../augmented-path';
import { execViaCmdArgv } from '../win-exec';
import { getCliVersion } from './getVersion';
import { resolveClaudePaths } from './getCliUpdateInfo';
import { detectPackageManager, updateModeFor, buildUpdateCommand, detectHomebrewCask } from '../cli-update';
import { MessageType, UpdateMode } from '../../shared';

const UPDATE_TIMEOUT_MS = 180000;
const UPDATE_MAX_BUFFER = 10 * 1024 * 1024;

/**
 * Run the install-method-specific update command. Updates can take a while
 * (download + link), so allow a generous timeout. Combine stdout+stderr for a
 * useful error message on failure.
 *
 * On win32 the launcher (`npm.cmd`, `volta.exe`, `brew`, `winget`, ...) resolves
 * through cmd.exe, but via [execViaCmdArgv] — a cmd.exe argv ARRAY, not
 * `shell:true` (which would tokenize a launcher/args path containing spaces such
 * as `C:\Program Files\...`, the v0.22.x defect). macOS/Linux run the launcher
 * directly with no shell. NATIVE's bare `claude` is routed through Claude.exec
 * upstream (it reuses the same launcher-resolving cmd.exe bypass).
 */
function runUpdate(command: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  if (process.platform === 'win32') {
    return execViaCmdArgv(command, args, {
      env: augmentedEnv(),
      timeout: UPDATE_TIMEOUT_MS,
      maxBuffer: UPDATE_MAX_BUFFER,
    }).then(({ err, stdout, stderr }) => ({
      ok: !err,
      output: `${stdout}${stderr}`.trim(),
    }));
  }
  return new Promise((resolve) => {
    cpExecFile(
      command,
      args,
      {
        env: augmentedEnv(),
        timeout: UPDATE_TIMEOUT_MS,
        maxBuffer: UPDATE_MAX_BUFFER,
        // macOS/Linux: run the launcher directly, no shell tokenization.
        shell: false,
      },
      (err, stdout, stderr) => {
        const output = `${stdout?.toString() ?? ''}${stderr?.toString() ?? ''}`.trim();
        resolve({ ok: !err, output });
      },
    );
  });
}

/**
 * Dispatch the update to the right runner by install method.
 *
 * NATIVE's bare `claude update` goes through [Claude.exec] with `shell:false`:
 * that reuses the SAME cmd.exe argv-array launcher bypass as MCP calls, so on
 * win32 a CLI installed under `C:\Program Files\...` (a path with a space) is
 * run without shell tokenization. Every other PM (`npm`/`pnpm`/`yarn`/`volta`/
 * `brew`/`winget`) is an external launcher, so it goes through [runUpdate],
 * which applies the same win32 cmd.exe-argv bypass generically.
 */
async function runUpdateSpec(command: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  if (command === 'claude') {
    try {
      // shell:false → on win32, Claude.exec resolves the `claude` launcher to an
      // absolute path and runs it via cmd.exe with an argv array (no tokenizing).
      const { stdout, stderr } = await Claude.exec(args, {
        shell: false,
        timeout: UPDATE_TIMEOUT_MS,
        maxBuffer: UPDATE_MAX_BUFFER,
      });
      return { ok: true, output: `${stdout}${stderr}`.trim() };
    } catch (err) {
      // execFile rejects on non-zero exit; surface stdout+stderr for the caller's
      // permission check. Node attaches these to the error object.
      const e = err as { stdout?: string | Buffer; stderr?: string; message?: string };
      const output = `${e.stdout?.toString() ?? ''}${e.stderr?.toString() ?? ''}`.trim() || e.message || '';
      return { ok: false, output };
    }
  }
  return runUpdate(command, args);
}

/**
 * True when an update failure looks like a permission problem: a global install
 * location the current (non-interactive) user cannot write to. Matches both the
 * OS errno codes (EACCES/EPERM) and the common textual phrasings package
 * managers print (npm's "EACCES: permission denied", "need sudo", etc.), since a
 * shelled-out PM reports the failure in stdout/stderr text rather than as a code.
 */
export function isPermissionFailure(output: string): boolean {
  return /\b(EACCES|EPERM)\b|permission denied|operation not permitted|\bsudo\b|need(s)? (to be )?run.*(root|administrator)|requires? (root|administrator|elevation)/i.test(
    output,
  );
}

/**
 * The command the user can paste into a terminal to update the CLI themselves.
 * CLI-equivalence: whatever the GUI would have run, we hand them verbatim so a
 * permission-blocked update still has a clear manual path.
 */
export function terminalHint(command: string, args: string[]): string {
  return [command, ...args].join(' ');
}

/**
 * Compose the user-facing message for a permission-blocked update. Non-silent:
 * it explains WHY the automatic update could not proceed and gives the exact
 * command (with `sudo` where a system location needs elevation).
 */
export function permissionErrorMessage(command: string, args: string[], output: string): string {
  const hint = terminalHint(command, args);
  const needsSudo = process.platform !== 'win32';
  const suggested = needsSudo ? `sudo ${hint}` : hint;
  return (
    `The update could not complete because it needs elevated permissions to write to a global ` +
    `install location. Run it yourself in a terminal:\n\n    ${suggested}\n\n` +
    (output ? `(original error: ${output})` : '')
  ).trim();
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

    console.log('claude update exec\n', spec.command, spec.args.join(' '), '\n');

    const { ok, output } = await runUpdateSpec(spec.command, spec.args);
    if (!ok) {
      // M3: a global install location the non-interactive backend cannot write
      // to (sudo-needing system PM, admin-only Program Files). Don't fail
      // silently — tell the user to run it in a terminal, with the exact command.
      if (isPermissionFailure(output)) {
        throw new Error(permissionErrorMessage(spec.command, spec.args, output));
      }
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
