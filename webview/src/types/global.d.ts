/**
 * Global type definitions for WebView-Kotlin IPC bridge
 */

interface Window {
  /**
   * JCEF environment marker.
   * Injected by ClaudeCodePanel.kt onLoadStart before page JS runs.
   */
  __JCEF__?: boolean;

  /**
   * Bridge to send messages from WebView to Kotlin
   * Injected by ClaudeCodePanel.kt via JBCefJSQuery
   */
  kotlinBridge?: {
    send: (message: IPCMessage) => void;
  };

  /**
   * Handler called by Kotlin to send messages to WebView
   * Implemented by useBridge.ts
   */
  dispatchKotlinMessage?: (message: IPCMessage) => void;
}

/**
 * IPC message structure for WebView <-> Kotlin communication
 */
interface IPCMessage {
  /**
   * Message type identifier
   * WebView -> Kotlin: SEND_MESSAGE, SESSION_CHANGE, TOOL_RESPONSE, APPLY_DIFF, REJECT_DIFF, START_SESSION, STOP_SESSION, CREATE_SESSION, OPEN_SETTINGS, OPEN_FILE
   * Kotlin -> WebView: ACK, ERROR, STREAM_EVENT, ASSISTANT_MESSAGE, RESULT_MESSAGE, SERVICE_ERROR, THEME_CHANGE
   */
  type: string;

  /**
   * Unique request identifier for matching responses
   */
  requestId?: string;

  /**
   * Message payload (type-specific data)
   */
  payload?: Record<string, unknown>;

  /**
   * Unix timestamp in milliseconds
   */
  timestamp: number;
}

/**
 * Typed payload interfaces for specific IPC message types.
 * IPCMessage.payload is Record<string, unknown> for flexibility,
 * but these interfaces document the expected shape for each message type.
 */

/** Payload for SEND_MESSAGE (WebView -> Backend) */
interface SendMessagePayload {
  sessionId: string;
  isNewSession: boolean;
  content: string;
  /** Image attachments encoded as base64 inline data */
  attachments?: Array<{
    fileName: string;
    mimeType: string;
    base64: string;
  }>;
  context: Array<Record<string, unknown>>;
  workingDir: string;
  inputMode: string;
}

/**
 * Message type constants for type safety
 */
declare const MessageTypes: {
  // WebView -> Kotlin
  readonly SEND_MESSAGE: 'SEND_MESSAGE';
  readonly SESSION_CHANGE: 'SESSION_CHANGE';
  readonly TOOL_RESPONSE: 'TOOL_RESPONSE';
  readonly APPLY_DIFF: 'APPLY_DIFF';
  readonly REJECT_DIFF: 'REJECT_DIFF';
  readonly START_SESSION: 'START_SESSION';
  readonly STOP_SESSION: 'STOP_SESSION';
  readonly CREATE_SESSION: 'CREATE_SESSION';
  readonly OPEN_SETTINGS: 'OPEN_SETTINGS';
  readonly OPEN_FILE: 'OPEN_FILE';

  // Kotlin -> WebView
  readonly ACK: 'ACK';
  readonly ERROR: 'ERROR';
  readonly STREAM_EVENT: 'STREAM_EVENT';
  readonly ASSISTANT_MESSAGE: 'ASSISTANT_MESSAGE';
  readonly RESULT_MESSAGE: 'RESULT_MESSAGE';
  readonly SERVICE_ERROR: 'SERVICE_ERROR';
  readonly THEME_CHANGE: 'THEME_CHANGE';
  readonly UNKNOWN_MESSAGE: 'UNKNOWN_MESSAGE';
};
