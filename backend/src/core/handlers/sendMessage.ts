import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { generateSessionId } from '../features/generateSessionId';
import { ensureClaudeProcess, sendMessageToProcess } from '../claude-process';

export async function sendMessageHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  bridge: Bridge,
): Promise<void> {
  const content = message.payload?.content as string;
  const workingDir = message.payload?.workingDir as string | undefined;
  const msgSessionId = message.payload?.sessionId as string | undefined;

  if (!workingDir) {
    connections.sendTo(connectionId, 'ERROR', {
      requestId: message.requestId,
      error: 'workingDir is required',
    });
    return;
  }
  const inputMode = message.payload?.inputMode as string;
  const resolvedSessionId = msgSessionId || generateSessionId();
  const attachments = message.payload?.attachments as Array<
    | { type: 'image'; fileName: string; mimeType: string; base64: string }
    | { type: 'file'; fileName: string; absolutePath: string }
    | { type: 'folder'; folderName: string; absolutePath: string }
  > | undefined;

  try {
    if (content || (attachments && attachments.length > 0)) {
      // Subscribe and ensure process is running (waits for spawn)
      connections.subscribe(connectionId, resolvedSessionId);
      await ensureClaudeProcess(connections, connectionId, workingDir, resolvedSessionId, inputMode, bridge);

      // Send content to process stdin
      sendMessageToProcess(connections, resolvedSessionId, content, attachments);

      // Broadcast user message to other subscribers (excluding sender)
      connections.broadcastToSession(resolvedSessionId, 'USER_MESSAGE_BROADCAST', {
        content: content.trim(),
        sessionId: resolvedSessionId,
      }, connectionId);
    }
  } catch (err) {
    // ensureClaudeProcess already broadcasts SERVICE_ERROR to the session.
    // Log here to prevent unhandled rejection; do NOT re-throw.
    console.error('[node-backend]', 'sendMessage failed:', err);
  } finally {
    connections.sendTo(connectionId, 'ACK', { requestId: message.requestId });
  }
}
