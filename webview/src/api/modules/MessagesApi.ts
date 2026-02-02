import { BridgeClient } from '../bridge/BridgeClient';

/**
 * Messages API module
 * RESTful operations for messages (child resource of sessions)
 *
 * Messages belong to sessions (N:1 relationship)
 * Streaming subscriptions are now managed by SessionsApi.show()
 */
export class MessagesApi {
  constructor(private bridge: BridgeClient) {}

  /**
   * Send a message to a session
   * POST /sessions/:sessionId/messages
   *
   * Note: Stream subscriptions are managed by SessionsApi.show()
   */
  async create(sessionId: string, content: string): Promise<void> {
    await this.bridge.request('SEND_MESSAGE', { sessionId, content });
  }

  /**
   * Subscribe to service errors (global, not session-specific)
   */
  onError(callback: (error: { type: string; message: string }) => void): () => void {
    return this.bridge.subscribe('SERVICE_ERROR', (message) => {
      callback({
        type: (message.payload?.type as string) || 'unknown',
        message: (message.payload?.message as string) || 'Unknown error',
      });
    });
  }
}
