import { exec, spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SleepGuardStatus {
  enabled: boolean;
  onlyOnPower: boolean;
  platform: string;
}

let sleepGuardEnabled = false;
let sleepOnlyOnPower = true;
let inhibitProcess: ChildProcess | null = null; // Linux only

export async function enableSleepGuard(onlyOnPower: boolean): Promise<void> {
  const platform = process.platform;
  sleepOnlyOnPower = onlyOnPower;

  try {
    if (platform === 'darwin') {
      const pmsetFlag = onlyOnPower ? '-c' : '-a';
      await execAsync(
        `osascript -e 'do shell script "pmset ${pmsetFlag} disablesleep 1" with administrator privileges'`
      );
    } else if (platform === 'linux') {
      if (inhibitProcess) {
        // Already inhibiting
        sleepGuardEnabled = true;
        return;
      }
      const proc = spawn(
        'systemd-inhibit',
        [
          '--what=sleep',
          '--who=Claude Code GUI',
          '--why=Tunnel active',
          'sleep',
          'infinity',
        ],
        {
          stdio: 'ignore',
          detached: true,
        }
      );
      proc.unref();
      inhibitProcess = proc;

      proc.on('error', (err) => {
        console.error('[node-backend]', 'systemd-inhibit error:', err);
        inhibitProcess = null;
        sleepGuardEnabled = false;
      });

      proc.on('exit', (code, signal) => {
        console.error('[node-backend]', `systemd-inhibit exited code=${code} signal=${signal}`);
        inhibitProcess = null;
        sleepGuardEnabled = false;
      });
    } else if (platform === 'win32') {
      await execAsync('powercfg /change standby-timeout-ac 0');
      if (!onlyOnPower) {
        await execAsync('powercfg /change standby-timeout-dc 0');
      }
    } else {
      console.error('[node-backend]', `enableSleepGuard: unsupported platform ${platform}`);
      return;
    }

    sleepGuardEnabled = true;
  } catch (err) {
    console.error('[node-backend]', 'Failed to enable sleep guard:', err);
    throw err;
  }
}

export async function disableSleepGuard(): Promise<void> {
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      await execAsync(
        `osascript -e 'do shell script "pmset disablesleep 0" with administrator privileges'`
      );
    } else if (platform === 'linux') {
      if (inhibitProcess) {
        try {
          inhibitProcess.kill('SIGTERM');
        } catch (err) {
          console.error('[node-backend]', 'Failed to kill inhibit process:', err);
        }
        inhibitProcess = null;
      }
    } else if (platform === 'win32') {
      await execAsync('powercfg /change standby-timeout-ac 30');
      if (!sleepOnlyOnPower) {
        await execAsync('powercfg /change standby-timeout-dc 15');
      }
    } else {
      console.error('[node-backend]', `disableSleepGuard: unsupported platform ${platform}`);
      return;
    }

    sleepGuardEnabled = false;
  } catch (err) {
    console.error('[node-backend]', 'Failed to disable sleep guard:', err);
    throw err;
  }
}

/**
 * Check actual system sleep guard state and sync in-memory variables.
 * Called on backend startup.
 */
export async function restoreSleepGuardState(): Promise<void> {
  const os = process.platform;
  try {
    if (os === 'darwin') {
      const { stdout } = await execAsync('pmset -g');
      // pmset -g output contains "disablesleep   1" when active
      const match = /disablesleep\s+(\d)/.exec(stdout);
      if (match && match[1] === '1') {
        sleepGuardEnabled = true;
        // Check if -c only or -a by testing battery settings
        const { stdout: batteryOut } = await execAsync('pmset -g custom').catch(() => ({ stdout: '' }));
        const batterySection = batteryOut.split('Battery Power:')[1] ?? '';
        const batteryMatch = /disablesleep\s+(\d)/.exec(batterySection);
        sleepOnlyOnPower = !batteryMatch || batteryMatch[1] === '0';
        console.error('[node-backend]', `Restored sleep guard state: enabled=true onlyOnPower=${sleepOnlyOnPower}`);
      }
    } else if (os === 'win32') {
      const { stdout } = await execAsync('powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE');
      // If AC timeout is 0x00000000, sleep is disabled
      const acMatch = /Current AC Power Setting Index:\s*0x([0-9a-fA-F]+)/.exec(stdout);
      if (acMatch && parseInt(acMatch[1], 16) === 0) {
        sleepGuardEnabled = true;
        const dcMatch = /Current DC Power Setting Index:\s*0x([0-9a-fA-F]+)/.exec(stdout);
        sleepOnlyOnPower = !dcMatch || parseInt(dcMatch[1], 16) !== 0;
        console.error('[node-backend]', `Restored sleep guard state: enabled=true onlyOnPower=${sleepOnlyOnPower}`);
      }
    }
    // Linux: systemd-inhibit process doesn't survive backend restart, no restore needed
  } catch {
    // ignore — unable to determine system state
  }
}

export function getSleepGuardStatus(): SleepGuardStatus {
  return {
    enabled: sleepGuardEnabled,
    onlyOnPower: sleepOnlyOnPower,
    platform: process.platform,
  };
}

// Cleanup on process exit
process.on('exit', () => {
  if (sleepGuardEnabled) {
    disableSleepGuard().catch((err) => {
      console.error('[node-backend]', 'cleanup disableSleepGuard failed:', err);
    });
  }
});

process.on('SIGTERM', () => {
  if (sleepGuardEnabled) {
    disableSleepGuard().catch((err) => {
      console.error('[node-backend]', 'SIGTERM disableSleepGuard failed:', err);
    });
  }
});
