import {
  spawn as cpSpawn,
  execFile as cpExecFile,
  type ChildProcess,
  type SpawnOptions,
  type ExecFileOptions,
} from 'child_process';
import { readSettingsFile, resolveClaudeConfigDirOverride } from './features/settings';
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
  // The CLAUDE_CONFIG_DIR the backend inherited at startup (e.g. exported in the
  // user's shell, or echoed temporarily). Captured once, before any plugin-settings
  // override is applied, so we can restore it when the override is later cleared.
  private static readonly inheritedConfigDir = process.env.CLAUDE_CONFIG_DIR;

  /** Load cliPath from settings. Call at server start or on settings change. */
  static async refresh(workingDir?: string): Promise<void> {
    const settings = await readSettingsFile();
    Claude.cliPath = (settings.cliPath as string) || null;
    Claude.initialized = true;
    await Claude.applyConfigDir(workingDir);
  }

  /**
   * Project the effective CLAUDE_CONFIG_DIR for the given working directory onto
   * process.env, so getClaudeConfigDir(), the spawned `claude`, and the `ccb` usage
   * child all resolve the SAME Claude data directory.
   *
   * Call this whenever an active context LOADS — a chat for a given workingDir, or the
   * project picker with no workingDir — NOT merely when a setting is saved. process.env
   * is a single shared slot on the backend, so projecting only at load time keeps a
   * project-scoped value from leaking across the whole backend (issue #123 follow-up).
   *
   * The Claude CLI reads CLAUDE_CONFIG_DIR only from process.env (never from
   * settings.json's `env`, which it consults too late), so we mirror our setting here.
   * Priority: settings env (project > global) > inherited startup env > ~/.claude.
   */
  static async applyConfigDir(workingDir?: string): Promise<void> {
    const override = await resolveClaudeConfigDirOverride(workingDir);
    if (override) {
      process.env.CLAUDE_CONFIG_DIR = override;
    } else if (Claude.inheritedConfigDir !== undefined) {
      process.env.CLAUDE_CONFIG_DIR = Claude.inheritedConfigDir;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }
  }

  static get command(): string {
    return Claude.cliPath || 'claude';
  }

  /**
   * The CLAUDE_CONFIG_DIR the backend inherited from its environment at startup,
   * before any plugin-settings override was applied (undefined if none). The settings
   * UI surfaces this so a value set only transiently (e.g. echoed/exported in a shell)
   * can be offered for persistence. (#123)
   */
  static get inheritedClaudeConfigDir(): string | undefined {
    return Claude.inheritedConfigDir;
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
