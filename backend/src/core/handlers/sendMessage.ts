import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { generateSessionId } from '../features/generateSessionId';
import { ensureClaudeProcess, sendMessageToProcess } from '../claude-process';
import { trackEvent, trackError } from '../features/telemetry';

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
  // 새 세션 여부는 webview가 판정해 payload로 알려준다. webview가 새 세션에도 sessionId를
  // 미리 생성해 보내므로(ChatStreamContext), 백엔드에서 sessionId 유무로는 판정할 수 없다.
  const isNewSession = message.payload?.isNewSession === true;
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

      // 새 세션이 시작된 경우에만 활성/사용 신호를 보낸다(동의 시에만, 내부에서 게이팅).
      // 공통 필드(os/버전 등)는 trackEvent가 자동으로 싣는다.
      if (isNewSession) {
        trackEvent('session_started');
      }
    }
  } catch (err) {
    // ensureClaudeProcess already broadcasts SERVICE_ERROR to the session.
    // Log here to prevent unhandled rejection; do NOT re-throw.
    console.error('[node-backend]', 'sendMessage failed:', err);
    trackError(err instanceof Error ? err : new Error(String(err)), { origin: 'sendMessage' });
  } finally {
    connections.sendTo(connectionId, 'ACK', { requestId: message.requestId });
  }
}
