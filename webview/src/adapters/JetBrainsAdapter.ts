import { IdeAdapterType, type IdeAdapter } from './IdeAdapter';

/**
 * JetBrains IDE Adapter
 *
 * Communicates directly with the JetBrains IDE via window.kotlinBridge.
 * Opens new editor tabs within the IDE.
 */
export class JetBrainsAdapter implements IdeAdapter {
  readonly type = IdeAdapterType.JETBRAINS;

  private sendToKotlin(message: IPCMessage): void {
    if (!window.kotlinBridge?.send) {
      throw new Error('Kotlin bridge is not available');
    }
    window.kotlinBridge.send(message);
  }

  isReady(): boolean {
    return !!window.kotlinBridge?.send;
  }

  async openNewTab(): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Bridge is not ready');
    }

    const message: IPCMessage = {
      type: 'NEW_SESSION',
      payload: {},
      timestamp: Date.now(),
    };

    this.sendToKotlin(message);
    console.log('[JetBrainsAdapter] Sent NEW_SESSION to open new editor tab');
  }

  async openSettings(): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Bridge is not ready');
    }

    const message: IPCMessage = {
      type: 'OPEN_SETTINGS',
      payload: {},
      timestamp: Date.now(),
    };

    this.sendToKotlin(message);
    console.log('[JetBrainsAdapter] Sent OPEN_SETTINGS to open settings in new tab');
  }

  async openFile(filePath: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Bridge is not ready');
    }

    const message: IPCMessage = {
      type: 'OPEN_FILE',
      payload: { filePath },
      timestamp: Date.now(),
    };

    this.sendToKotlin(message);
    console.log('[JetBrainsAdapter] Sent OPEN_FILE:', filePath);
  }
}
