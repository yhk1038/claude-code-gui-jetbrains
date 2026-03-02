import { IdeAdapterType, type IdeAdapter } from './IdeAdapter';
import { getBridge } from '../api/bridge/Bridge';

/**
 * JetBrains IDE Adapter
 *
 * Communicates with the JetBrains IDE via WebSocket → Node.js backend → Kotlin RPC.
 * Opens new editor tabs, settings, and files within the IDE.
 */
export class JetBrainsAdapter implements IdeAdapter {
  readonly type = IdeAdapterType.JETBRAINS;

  isReady(): boolean {
    return getBridge().isConnected;
  }

  async openNewTab(): Promise<void> {
    await getBridge().request('NEW_SESSION');
    console.log('[JetBrainsAdapter] Sent NEW_SESSION via WebSocket bridge');
  }

  async openSettings(): Promise<void> {
    await getBridge().request('OPEN_SETTINGS');
    console.log('[JetBrainsAdapter] Sent OPEN_SETTINGS via WebSocket bridge');
  }

  async openFile(filePath: string): Promise<void> {
    await getBridge().request('OPEN_FILE', { filePath });
    console.log('[JetBrainsAdapter] Sent OPEN_FILE via WebSocket bridge:', filePath);
  }
}
