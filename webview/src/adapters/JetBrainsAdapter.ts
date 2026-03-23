import { ClientEnv } from '../shared';
import type { IdeAdapter } from './IdeAdapter';
import { getBridge } from '../api/bridge/Bridge';

/**
 * JetBrains IDE Adapter
 *
 * Communicates with the JetBrains IDE via WebSocket → Node.js backend → Kotlin RPC.
 * Opens new editor tabs, settings, and files within the IDE.
 */
export class JetBrainsAdapter implements IdeAdapter {
  readonly type = ClientEnv.JETBRAINS;

  isReady(): boolean {
    return getBridge().isConnected;
  }

  async openNewTab(): Promise<void> {
    await getBridge().request('OPEN_NEW_TAB');
    console.log('[JetBrainsAdapter] Sent OPEN_NEW_TAB via WebSocket bridge');
  }

  async openSettings(): Promise<void> {
    await getBridge().request('OPEN_SETTINGS');
    console.log('[JetBrainsAdapter] Sent OPEN_SETTINGS via WebSocket bridge');
  }

  async openFile(filePath: string): Promise<void> {
    await getBridge().request('OPEN_FILE', { filePath });
    console.log('[JetBrainsAdapter] Sent OPEN_FILE via WebSocket bridge:', filePath);
  }

  async openTerminal(workingDir: string): Promise<void> {
    await getBridge().request('OPEN_TERMINAL', { workingDir });
    console.log('[JetBrainsAdapter] Sent OPEN_TERMINAL via WebSocket bridge:', workingDir);
  }

  async openUrl(url: string): Promise<void> {
    await getBridge().request('OPEN_URL', { url });
    console.log('[JetBrainsAdapter] Sent OPEN_URL via WebSocket bridge:', url);
  }
}
