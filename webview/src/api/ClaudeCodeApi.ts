import { BridgeClient, getBridgeClient } from './bridge/BridgeClient';
import { SessionsApi } from './modules/SessionsApi';
import { MessagesApi } from './modules/MessagesApi';
import { ToolsApi } from './modules/ToolsApi';

/**
 * API configuration options
 */
export interface ApiConfig {
  workingDir?: string;
}

/**
 * Main API class for Claude Code WebView
 * Provides typed, RESTful-style access to all backend operations
 *
 * Usage:
 * ```typescript
 * import { api } from './api/ClaudeCodeApi';
 *
 * // Configure working directory
 * api.setWorkingDir('/path/to/project');
 *
 * // Session operations (parent resource)
 * const sessions = await api.sessions.index();
 *
 * // Load session with message subscription
 * const { messages } = await api.sessions.show(sessionId, (message) => {
 *   // Handle streaming messages
 *   switch (message.type) {
 *     case 'content_block_delta':
 *       // Update UI with delta
 *       break;
 *     case 'assistant':
 *       // Complete assistant message
 *       break;
 *     case 'result':
 *       // Stream complete
 *       break;
 *   }
 * });
 *
 * // Send message (subscriptions managed by show())
 * await api.messages.create(sessionId, 'Hello');
 *
 * // Tool operations
 * await api.tools.approve(toolUseId);
 * ```
 */
export class ClaudeCodeApi {
  private bridge: BridgeClient;
  private config: ApiConfig;

  readonly sessions: SessionsApi;
  readonly messages: MessagesApi;
  readonly tools: ToolsApi;

  constructor(configOrBridge?: ApiConfig | BridgeClient, bridge?: BridgeClient) {
    // Handle both constructor signatures for backwards compatibility
    if (configOrBridge instanceof BridgeClient) {
      this.bridge = configOrBridge;
      this.config = {};
    } else {
      this.config = configOrBridge || {};
      this.bridge = bridge || getBridgeClient();
    }

    // Create config getter for modules that need it
    const getConfig = () => this.config;

    this.sessions = new SessionsApi(this.bridge, getConfig);
    this.messages = new MessagesApi(this.bridge);
    this.tools = new ToolsApi(this.bridge);
  }

  /**
   * Set the working directory for all API operations
   */
  setWorkingDir(dir: string): void {
    this.config.workingDir = dir;
  }

  /**
   * Get the current working directory
   */
  get workingDir(): string | undefined {
    return this.config.workingDir;
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
