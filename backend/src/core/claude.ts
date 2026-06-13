import {
  spawn as cpSpawn,
  execFile as cpExecFile,
  type ChildProcess,
  type SpawnOptions,
  type ExecFileOptions,
} from 'child_process';
import { readSettingsFile } from './features/settings';
import { augmentedPath } from './augmented-path';
import { isWslUncPath, toWslPath } from './wsl-path';

/**
 * In a WSL backend (running inside the distro, platform === 'linux') the IDE hands us the
 * project root as a Windows UNC path (`//wsl.localhost/Ubuntu/home/...`). That path does not
 * exist inside the distro, so spawning the CLI with it as cwd fails with `spawn ... ENOENT`
 * — the *cwd*, not the binary, is missing. Convert it to the inner Linux path. Issue #57.
 */
function resolveWslCwd(cwd: SpawnOptions['cwd']): SpawnOptions['cwd'] {
  if (process.platform === 'linux' && typeof cwd === 'string' && isWslUncPath(cwd)) {
    return toWslPath(cwd) ?? cwd;
  }
  return cwd;
}

export class Claude {
  private static cliPath: string | null = null;
  private static initialized = false;

  /** Load cliPath from settings. Call at server start or on settings change. */
  static async refresh(): Promise<void> {
    const settings = await readSettingsFile();
    Claude.cliPath = (settings.cliPath as string) || null;
    Claude.initialized = true;
  }

  static get command(): string {
    return Claude.cliPath || 'claude';
  }

  static get env(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      PATH: augmentedPath(),
    };
  }

  static spawn(args: string[], options?: SpawnOptions): ChildProcess {
    return cpSpawn(Claude.command, args, {
      ...options,
      cwd: resolveWslCwd(options?.cwd),
      shell: options?.shell ?? (process.platform === 'win32'),
      env: {
        ...Claude.env,
        ...options?.env,
      },
    });
  }

  static exec(args: string[], options?: ExecFileOptions): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      cpExecFile(Claude.command, args, {
        timeout: 10000,
        ...options,
        cwd: resolveWslCwd(options?.cwd),
        // On Windows the `claude` launcher is a .cmd/.ps1 wrapper that execFile
        // cannot run without a shell (it fails with ENOENT). spawn() already
        // runs through a shell on win32; keep exec() symmetric so `auth status`
        // and `--version` resolve the wrapper. Without this, GET_ACCOUNT always
        // reported "not logged in" and users were stuck on the login screen
        // even while authenticated (#99).
        shell: options?.shell ?? (process.platform === 'win32'),
        env: {
          ...Claude.env,
          ...options?.env,
        },
      }, (err, stdout, stderr) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({ stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' });
      });
    });
  }

  static which(): Promise<string | null> {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    return new Promise((resolve) => {
      cpExecFile(cmd, [Claude.command], {
        env: Claude.env,
        timeout: 5000,
      }, (err, stdout) => {
        resolve(err ? null : (stdout?.toString() ?? '').trim().split('\n')[0] || null);
      });
    });
  }

}
