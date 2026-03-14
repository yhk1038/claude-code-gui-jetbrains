import {
  spawn as cpSpawn,
  execFile as cpExecFile,
  execFileSync,
  type ChildProcess,
  type SpawnOptions,
  type ExecFileOptions,
} from 'child_process';
import { existsSync } from 'fs';
import { join, delimiter, resolve } from 'path';
import { readSettingsFile } from './features/settings';

export class Claude {
  private static augmentedPath: string = Claude.buildAugmentedPath();
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
      PATH: Claude.augmentedPath,
    };
  }

  static spawn(args: string[], options?: SpawnOptions): ChildProcess {
    return cpSpawn(Claude.command, args, {
      ...options,
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

  /**
   * Build an augmented PATH that includes well-known bin directories where
   * `claude` CLI is likely installed.  IDE-spawned Node.js processes often
   * inherit a minimal PATH that doesn't include nvm / volta / homebrew paths.
   */
  private static buildAugmentedPath(): string {
    const basePath = process.env.PATH ?? '';
    const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
    if (!home) return basePath;

    const extraDirs: string[] = [
      join(home, '.local', 'bin'),          // pipx / manual installs
      join(home, '.npm-global', 'bin'),     // npm global (custom prefix)
      join(home, '.volta', 'bin'),          // volta
      join(home, '.fnm', 'aliases', 'default', 'bin'), // fnm
    ];
    if (process.platform !== 'win32') {
      extraDirs.push(
        '/usr/local/bin',                    // macOS default / homebrew (Intel)
        '/opt/homebrew/bin',                 // homebrew (Apple Silicon)
      );
    }

    // Add nvm current version bin if NVM_DIR is set
    const nvmDir = process.env.NVM_DIR ?? join(home, '.nvm');
    try {
      // Validate nvmDir is a real path (prevent injection via NVM_DIR)
      const resolvedNvmDir = resolve(nvmDir);
      const nvmScript = join(resolvedNvmDir, 'nvm.sh');
      if (!existsSync(nvmScript)) throw new Error('nvm.sh not found');

      // Escape single quotes in path for safe bash embedding: ' -> '\''
      const escapedNvmScript = nvmScript.replace(/'/g, "'\\''");
      const nvmDefaultBin = execFileSync(
        'bash',
        ['-c', `source '${escapedNvmScript}' --no-use 2>/dev/null && nvm which current 2>/dev/null`],
        { encoding: 'utf-8', timeout: 3000 },
      ).trim();
      if (nvmDefaultBin) {
        const nvmBinDir = nvmDefaultBin.substring(0, nvmDefaultBin.lastIndexOf('/'));
        if (nvmBinDir) extraDirs.push(nvmBinDir);
      }
    } catch {
      // nvm not available - skip
    }

    const priorityDirs = extraDirs.filter(d => existsSync(d));
    if (priorityDirs.length === 0) return basePath;
    const prioritySet = new Set(priorityDirs);
    const remaining = basePath.split(delimiter).filter(d => !prioritySet.has(d)).join(delimiter);
    return `${priorityDirs.join(delimiter)}${delimiter}${remaining}`;
  }
}
