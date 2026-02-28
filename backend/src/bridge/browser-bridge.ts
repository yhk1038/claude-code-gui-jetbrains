import { exec } from 'child_process';
import type { Bridge } from './bridge-interface';

/**
 * Browser-mode bridge for dev environment.
 * Uses OS-native commands for file opening; other IDE-specific
 * operations are no-ops since there is no IDE host.
 */
export class BrowserBridge implements Bridge {
  async openFile(path: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const command = process.platform === 'darwin'
        ? `open "${path}"`
        : `xdg-open "${path}"`;

      exec(command, (err) => {
        if (err) {
          console.error('[node-backend]', 'Failed to open file:', err.message);
        }
        resolve();
      });
    });
  }

  async openDiff(): Promise<void> {
    // no-op: diff viewer not available in browser mode
  }

  async applyDiff(): Promise<{ applied: boolean }> {
    return { applied: false };
  }

  async rejectDiff(): Promise<void> {
    // no-op
  }

  async newSession(): Promise<void> {
    // no-op: handled by session reset in browser mode
  }

  async openSettings(): Promise<void> {
    // no-op
  }
}
