import {
  spawn as cpSpawn,
  execFile as cpExecFile,
  type ChildProcess,
  type SpawnOptions,
  type ExecFileOptions,
} from 'child_process';
import { readSettingsFile } from './features/settings';
import { augmentedPath } from './augmented-path';

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
