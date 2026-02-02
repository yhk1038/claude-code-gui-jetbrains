/**
 * Bridge client for communication with Kotlin backend
 * Wraps the existing useBridge hook functionality for use in API classes
 */

type MessageHandler = (message: IPCMessage) => void;
type SendFn = (type: string, payload: Record<string, unknown>) => Promise<any>;
type SubscribeFn = (type: string, handler: MessageHandler) => () => void;

export class BridgeClient {
  private sendFn: SendFn | null = null;
  private subscribeFn: SubscribeFn | null = null;
  private isConnected = false;

  /**
   * Initialize the bridge client with send and subscribe functions from useBridge
   */
  initialize(send: SendFn, subscribe: SubscribeFn, connected: boolean): void {
    this.sendFn = send;
    this.subscribeFn = subscribe;
    this.isConnected = connected;
  }

  /**
   * Update connection status
   */
  setConnected(connected: boolean): void {
    this.isConnected = connected;
  }

  /**
   * Check if bridge is connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Send a request to the Kotlin backend
   * @param type Message type (e.g., 'GET_SESSIONS', 'SEND_MESSAGE')
   * @param payload Request payload
   * @returns Promise resolving to the response payload
   */
  async request<T = unknown>(
    type: string,
    payload: Record<string, unknown> = {}
  ): Promise<T> {
    if (!this.sendFn) {
      throw new Error('BridgeClient not initialized. Call initialize() first.');
    }

    if (!this.isConnected) {
      throw new Error('Bridge not connected');
    }

    return this.sendFn(type, payload) as Promise<T>;
  }

  /**
   * Subscribe to messages of a specific type
   * @param type Message type to subscribe to
   * @param handler Handler function for messages
   * @returns Unsubscribe function
   */
  subscribe(type: string, handler: MessageHandler): () => void {
    if (!this.subscribeFn) {
      console.warn('BridgeClient not initialized. Subscription will be ignored.');
      return () => {};
    }

    return this.subscribeFn(type, handler);
  }

  /**
   * Subscribe to a message type and return a promise that resolves on first message
   * Useful for one-time event waiting
   */
  waitFor<T = unknown>(type: string, timeout = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timeout waiting for ${type}`));
      }, timeout);

      const unsubscribe = this.subscribe(type, (message) => {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(message.payload as T);
      });
    });
  }
}

// Singleton instance
let bridgeClientInstance: BridgeClient | null = null;

export function getBridgeClient(): BridgeClient {
  if (!bridgeClientInstance) {
    bridgeClientInstance = new BridgeClient();
  }
  return bridgeClientInstance;
}
