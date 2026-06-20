import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { generateSessionId } from '../features/generateSessionId';
import { ensureClaudeProcess, sendMessageToProcess } from '../claude-process';
import { trackEvent } from '../features/telemetry';
import { buildSettingsSnapshot } from '../features/settingsSnapshot';
import { getPluginVersion } from './getVersion';

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
  // sessionId가 없으면 이번 메시지로 새 세션이 생성된다 = 세션 시작.
  const isNewSession = !msgSessionId;
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
      // 설정 스냅샷은 평문이되 경로는 홈→'~' 치환, 세션 제목/내용은 절대 미포함.
      if (isNewSession) {
        const settings = await buildSettingsSnapshot(workingDir);
        void trackEvent('session_started', { pluginVersion: getPluginVersion(), ...settings });
      }
    }
  } catch (err) {
    // ensureClaudeProcess already broadcasts SERVICE_ERROR to the session.
    // Log here to prevent unhandled rejection; do NOT re-throw.
    console.error('[node-backend]', 'sendMessage failed:', err);
  } finally {
    connections.sendTo(connectionId, 'ACK', { requestId: message.requestId });
  }
}
