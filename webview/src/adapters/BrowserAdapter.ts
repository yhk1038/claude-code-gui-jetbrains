import { IdeAdapterType, type IdeAdapter } from './IdeAdapter';
import { getBridge } from '../api/bridge/Bridge';

/**
 * Browser Adapter
 *
 * Handles operations when running in a browser environment (dev mode).
 * Opens new browser tabs using window.open().
 */
export class BrowserAdapter implements IdeAdapter {
  readonly type = IdeAdapterType.BROWSER;

  isReady(): boolean {
    return true; // Browser is always ready
  }

  async openNewTab(): Promise<void> {
    // Open a new browser tab with the same URL
    const newWindow = window.open(window.location.href, '_blank');

    if (!newWindow) {
      throw new Error('Failed to open new tab. Pop-up might be blocked.');
    }

    console.log('[BrowserAdapter] Opened new browser tab');
  }

  async openSettings(): Promise<void> {
    const url = new URL(window.location.href);
    url.hash = '#/settings/general';
    const newWindow = window.open(url.toString(), '_blank');

    if (!newWindow) {
      throw new Error('Failed to open settings tab. Pop-up might be blocked.');
    }

    console.log('[BrowserAdapter] Opened settings in new browser tab');
  }

  async openFile(filePath: string): Promise<void> {
    try {
      await getBridge().request('OPEN_FILE', { filePath });
      console.log('[BrowserAdapter] Sent OPEN_FILE request:', filePath);
    } catch (error) {
      console.error('[BrowserAdapter] Failed to open file:', filePath, error);
    }
  }
}
