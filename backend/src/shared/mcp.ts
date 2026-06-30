/**
 * Shared MCP (Model Context Protocol) server management types.
 *
 * NOTE: This file is mirrored 1:1 in `webview/src/shared/mcp.ts`.
 * Any edit here MUST be copied there (see `shared/CLAUDE.md`).
 */

/** Runtime connection status of an MCP server. Source: `claude mcp list/get` or control protocol. */
export enum McpServerStatus {
  CONNECTED = 'connected',
  FAILED = 'failed',
  /** Server requires authentication before it can connect. */
  NEEDS_AUTH = 'needs-auth',
  /** Connection attempt in progress. */
  PENDING = 'pending',
  /** Manually disabled by the user (disabledMcpServers list). Not reported by CLI — derived from config file. */
  DISABLED = 'disabled',
}

/** Config scope the server belongs to. Used as the list grouping key. */
export enum McpServerScope {
  /** ~/.mcp.json or `.mcp.json` in the project root. */
  PROJECT = 'project',
  /** Local project-level config (settings.local.json or .clauderc). */
  LOCAL = 'local',
  /** User-level config in ~/.claude.json. */
  USER = 'user',
  /** Managed by claude.ai (connectors like Gmail, Calendar, Notion). */
  CLAUDEAI = 'claudeai',
  MANAGED = 'managed',
  ENTERPRISE = 'enterprise',
}

/** Transport protocol of the MCP server. */
export enum McpTransportType {
  STDIO = 'stdio',
  HTTP = 'http',
  /** Server-Sent Events (legacy, deprecated upstream). */
  SSE = 'sse',
  WS = 'ws',
  /** claude.ai managed connector (OAuth via claude.ai org URL, no Clear auth). */
  CLAUDEAI_PROXY = 'claudeai-proxy',
}

export interface McpServerConfig {
  type: McpTransportType;
  /** stdio: the executable command. */
  command?: string;
  /** stdio: positional arguments to the command. */
  args?: string[];
  /** stdio: environment variable overrides passed to the server process. */
  env?: Record<string, string>;
  /** http / sse / ws: server endpoint URL. */
  url?: string;
  /** http: extra request headers. */
  headers?: Record<string, string>;
  /** claudeai-proxy: internal connector identifier. */
  id?: string;
  /** claudeai-proxy: human-readable connector display name. */
  displayName?: string;
  /** claudeai-proxy: connector icon URL. */
  iconUrl?: string;
}

export interface McpServerTool {
  name: string;
  annotations?: {
    /** Tool only reads data — no side effects. */
    readOnly?: boolean;
    /** Tool can perform irreversible destructive operations. */
    destructive?: boolean;
  };
}

export interface McpServer {
  name: string;
  status: McpServerStatus;
  /** Grouping key for the list UI. Cast to McpServerScope when known; raw string otherwise. */
  scope: McpServerScope | string;
  /**
   * Null when the CLI does not report transport details for this server
   * (e.g. claude.ai connectors, or servers added without an explicit type).
   * WebView: filter out "Add transport" prompts for null-config servers.
   */
  config: McpServerConfig | null;
  /** Available tools reported by the server. Empty array when not yet fetched. */
  tools: McpServerTool[];
  /** Human-readable error message, populated when status === FAILED or NEEDS_AUTH. */
  error: string | null;
}

/** Payload of GET_MCP_SERVERS ACK response. */
export interface McpServersResult {
  servers: McpServer[];
}

/**
 * xme rule (from Cursor source analysis): only sse/http/claudeai-proxy servers
 * expose authentication buttons. stdio servers have no auth flow.
 */
export function canAuthenticate(server: McpServer): boolean {
  if (!server.config) return false;
  return (
    server.config.type === McpTransportType.SSE ||
    server.config.type === McpTransportType.HTTP ||
    server.config.type === McpTransportType.CLAUDEAI_PROXY
  );
}
