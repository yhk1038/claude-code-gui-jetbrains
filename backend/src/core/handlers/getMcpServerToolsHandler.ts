import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { MessageType } from '../../shared';
import type { McpServerConfig } from '../../shared';
import { fetchServerTools } from '../features/mcp-tools';

/**
 * GET_MCP_SERVER_TOOLS — connect to one MCP server and return its tool list.
 *
 * The server's `config` is sent by the WebView (it already holds it from the
 * list), so the backend connects directly via the MCP SDK without re-running
 * `claude mcp get`. There is no `claude` command that reports tools, so speaking
 * the open MCP protocol (tools/list) is the CLI-equivalent here.
 */
export async function getMcpServerToolsHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const config = (message.payload as { config?: McpServerConfig | null })?.config ?? null;
  try {
    const tools = await fetchServerTools(config);
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'ok',
      tools,
    });
  } catch (err) {
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
