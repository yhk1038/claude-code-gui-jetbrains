import { BridgeClient, getBridgeClient } from './bridge/BridgeClient';
import { SessionsApi } from './modules/SessionsApi';
import { MessagesApi } from './modules/MessagesApi';
import { ToolsApi } from './modules/ToolsApi';

/**
 * Main API class for Claude Code WebView
 * Provides typed, RESTful-style access to all backend operations
 *
 * Usage:
 * ```typescript
 * import { api } from './api/ClaudeCodeApi';
 *
 * // Session operations
 * const sessions = await api.sessions.getList();
 * await api.sessions.load(sessionId);
 *
 * // Message operations
 * await api.messages.send('Hello');
 * api.messages.onStreamEvent((event) => console.log(event));
 *
 * // Tool operations
 * await api.tools.approve(toolUseId);
 * await api.tools.applyDiff(toolUseId);
 * ```
 */
export class ClaudeCodeApi {
  private bridge: BridgeClient;

  readonly sessions: SessionsApi;
  readonly messages: MessagesApi;
  readonly tools: ToolsApi;

  constructor(bridge?: BridgeClient) {
    this.bridge = bridge || getBridgeClient();
    this.sessions = new SessionsApi(this.bridge);
    this.messages = new MessagesApi(this.bridge);
    this.tools = new ToolsApi(this.bridge);
  }

  /**
   * Initialize the API with bridge functions from useBridge hook
   * Must be called before using the API
   */
  initialize(
    send: (type: string, payload: Record<string, unknown>) => Promise<any>,
    subscribe: (type: string, handler: (message: IPCMessage) => void) => () => void,
    isConnected: boolean
  ): void {
    this.bridge.initialize(send, subscribe, isConnected);
  }

  /**
   * Update connection status
   */
  setConnected(connected: boolean): void {
    this.bridge.setConnected(connected);
  }

  /**
   * Check if the API is connected to the backend
   */
  get isConnected(): boolean {
    return this.bridge.connected;
  }

  /**
   * Start the CLI service
   */
  async startService(): Promise<void> {
    await this.bridge.request('START_SESSION', {});
  }

  /**
   * Stop the CLI service
   */
  async stopService(): Promise<void> {
    await this.bridge.request('STOP_SESSION', {});
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(
    callback: (state: string) => void
  ): () => void {
    return this.bridge.subscribe('STATE_CHANGE', (message) => {
      callback(message.payload?.state as string);
    });
  }
}

// Singleton instance
let apiInstance: ClaudeCodeApi | null = null;

/**
 * Get the singleton API instance
 */
export function getApi(): ClaudeCodeApi {
  if (!apiInstance) {
    apiInstance = new ClaudeCodeApi();
  }
  return apiInstance;
}

/**
 * Default export for convenient importing
 * Usage: import { api } from './api/ClaudeCodeApi';
 */
export const api = getApi();
