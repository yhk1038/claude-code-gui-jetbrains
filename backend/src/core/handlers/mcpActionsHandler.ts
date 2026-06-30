import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { MessageType } from '../../shared';
import {
  reconnectMcpServer,
  setMcpServerEnabled,
  addMcpServer,
  removeMcpServer,
} from '../features/mcp-manager';
import { searchMcpRegistry } from '../features/mcp-registry';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ack(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  payload: Record<string, unknown>,
): void {
  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    ...payload,
  });
}

function getStringPayload(message: IPCMessage, key: string): string | null {
  const val = (message.payload as Record<string, unknown>)?.[key];
  return typeof val === 'string' && val.trim() ? val.trim() : null;
}

// ─── RECONNECT_MCP_SERVER ─────────────────────────────────────────────────────

/**
 * Re-fetch a server via `claude mcp get <name>`. The CLI health-checks the
 * connection when invoked, so re-running it serves as a CLI-first reconnect probe.
 */
export async function reconnectMcpServerHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const name = getStringPayload(message, 'name');
  if (!name) {
    return ack(connectionId, message, connections, { status: 'error', error: 'Missing name' });
  }
  try {
    const server = await reconnectMcpServer(name, getStringPayload(message, 'workingDir') ?? undefined);
    ack(connectionId, message, connections, { status: 'ok', server });
  } catch (err) {
    ack(connectionId, message, connections, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── AUTHENTICATE_MCP_SERVER ──────────────────────────────────────────────────

/**
 * Trigger auth for an MCP server.
 *
 * CLI-first note: `claude mcp login` exists in v2.1.186+ but runs interactively
 * (opens a browser and blocks until completion). We cannot run it in the
 * non-interactive backend exec path without a terminal. For now we return a
 * terminal instruction; the control_request auxiliary path (mcp_authenticate)
 * is handled by the active claude process, not here.
 *
 * TODO: When the CLI provides a non-interactive auth flow, replace this with
 * `Claude.exec(['mcp', 'login', name])`.
 */
export async function authenticateMcpServerHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const name = getStringPayload(message, 'name');
  if (!name) {
    return ack(connectionId, message, connections, { status: 'error', error: 'Missing name' });
  }
  // Return a hint so the webview can display guidance.
  ack(connectionId, message, connections, {
    status: 'terminal-required',
    hint: `Run in terminal: claude mcp login "${name}"`,
  });
}

// ─── CLEAR_MCP_SERVER_AUTH ────────────────────────────────────────────────────

/**
 * Clear saved auth for an MCP server.
 * Same constraint as authenticate — no non-interactive CLI command available yet.
 */
export async function clearMcpServerAuthHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const name = getStringPayload(message, 'name');
  if (!name) {
    return ack(connectionId, message, connections, { status: 'error', error: 'Missing name' });
  }
  ack(connectionId, message, connections, {
    status: 'terminal-required',
    hint: `Run in terminal: claude mcp logout "${name}"`,
  });
}

// ─── SET_MCP_SERVER_ENABLED ───────────────────────────────────────────────────

/**
 * Enable or disable a named MCP server by editing disabledMcpServers in ~/.claude.json.
 * No CLI command exists for this — CLI users also edit the file directly.
 */
export async function setMcpServerEnabledHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const name = getStringPayload(message, 'name');
  const enabled = (message.payload as Record<string, unknown>)?.enabled;
  if (!name) {
    return ack(connectionId, message, connections, { status: 'error', error: 'Missing name' });
  }
  if (typeof enabled !== 'boolean') {
    return ack(connectionId, message, connections, {
      status: 'error',
      error: 'Missing or invalid enabled (must be boolean)',
    });
  }
  try {
    await setMcpServerEnabled(name, enabled);
    ack(connectionId, message, connections, { status: 'ok', name, enabled });
  } catch (err) {
    ack(connectionId, message, connections, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── SUBMIT_MCP_OAUTH_CALLBACK_URL ───────────────────────────────────────────

/**
 * Submit an OAuth callback URL for a server that failed to redirect automatically.
 * Requires the active claude process to handle the OAuth flow — not implementable
 * as a standalone CLI command. Returns a guidance message for now.
 */
export async function submitMcpOauthCallbackUrlHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  ack(connectionId, message, connections, {
    status: 'not-implemented',
    hint: 'OAuth callback URL submission requires an active Claude session.',
  });
}

// ─── ADD_MCP_SERVER (Phase 3) ─────────────────────────────────────────────────

/**
 * Add a new MCP server via `claude mcp add-json`.
 * Payload: { name: string, config: object, scope: 'user' | 'project' | 'local' }
 */
export async function addMcpServerHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const payload = message.payload as Record<string, unknown>;
  const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
  const config = payload?.config as Record<string, unknown> | undefined;
  const scope = typeof payload?.scope === 'string' ? payload.scope : 'user';

  if (!name) {
    return ack(connectionId, message, connections, { status: 'error', error: 'Missing name' });
  }
  if (!config || typeof config !== 'object') {
    return ack(connectionId, message, connections, {
      status: 'error',
      error: 'Missing or invalid config',
    });
  }
  try {
    await addMcpServer(name, config, scope, getStringPayload(message, 'workingDir') ?? undefined);
    ack(connectionId, message, connections, { status: 'ok', name });
  } catch (err) {
    ack(connectionId, message, connections, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── SEARCH_MCP_REGISTRY ──────────────────────────────────────────────────────

/**
 * Search the official MCP registry for installable servers.
 * Payload: { query: string, cursor?: string }
 *
 * CLI-equivalence note: `claude mcp` has no `search` subcommand, so this is a
 * GUI-only capability backed by the registry's PUBLIC REST API (not the Claude
 * SDK). Installation still goes through `claude mcp add-json` (ADD_MCP_SERVER).
 */
export async function searchMcpRegistryHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const payload = message.payload as Record<string, unknown>;
  const query = typeof payload?.query === 'string' ? payload.query : '';
  const cursor = typeof payload?.cursor === 'string' ? payload.cursor : undefined;
  try {
    const result = await searchMcpRegistry(query, cursor);
    ack(connectionId, message, connections, { status: 'ok', ...result });
  } catch (err) {
    ack(connectionId, message, connections, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── REMOVE_MCP_SERVER (Phase 3) ──────────────────────────────────────────────

/**
 * Remove a named MCP server via `claude mcp remove`.
 * Payload: { name: string, scope: 'user' | 'project' | 'local' | 'claudeai' }
 */
export async function removeMcpServerHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const name = getStringPayload(message, 'name');
  const scope =
    typeof (message.payload as Record<string, unknown>)?.scope === 'string'
      ? ((message.payload as Record<string, unknown>).scope as string)
      : 'user';

  if (!name) {
    return ack(connectionId, message, connections, { status: 'error', error: 'Missing name' });
  }
  try {
    await removeMcpServer(name, scope, getStringPayload(message, 'workingDir') ?? undefined);
    ack(connectionId, message, connections, { status: 'ok', name });
  } catch (err) {
    ack(connectionId, message, connections, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
