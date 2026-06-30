import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { MessageType } from '../../shared';
import { getMcpServers } from '../features/mcp-manager';

/**
 * GET_MCP_SERVERS — list all MCP servers with status, scope, and config.
 *
 * Data source priority (CLI-first, per CLAUDE.md):
 *   1. `claude mcp list` (health check + names)
 *   2. `claude mcp get <name>` (full details per server)
 *   3. disabledMcpServers in ~/.claude.json (disabled state)
 */
export async function getMcpServersHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  try {
    const result = await getMcpServers();
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'ok',
      servers: result.servers,
      configPath: result.configPath,
    });
  } catch (err) {
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
