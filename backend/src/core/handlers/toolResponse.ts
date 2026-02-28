import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { sendMessageToProcess } from '../claude-process';

export function toolResponseHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): void {
  const client = connections.getClient(connectionId);
  const sessionId = client?.subscribedSessionId;

  if (!sessionId) {
    console.error('[node-backend]', 'TOOL_RESPONSE received but no subscribed session');
    connections.sendTo(connectionId, 'ACK', { requestId: message.requestId });
    return;
  }

  const toolUseId = message.payload?.toolUseId as string;
  const approved = (message.payload?.approved as boolean) ?? true;
  const resultContent =
    (message.payload?.result as string) ||
    (approved ? 'Tool execution approved' : 'Tool execution rejected');

  // Build tool result JSON matching Kotlin's format
  const toolResult = {
    tool_use_id: toolUseId,
    content: resultContent,
    is_error: !approved,
  };

  // Send as user message wrapping the tool result (matches Kotlin's sendCliMessage pattern)
  const toolResultJson = JSON.stringify(toolResult);
  sendMessageToProcess(connections, sessionId, toolResultJson);

  console.error('[node-backend]', `TOOL_RESPONSE sent for tool ${toolUseId} (approved: ${approved})`);
  connections.sendTo(connectionId, 'ACK', { requestId: message.requestId });
}
