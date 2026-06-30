/**
 * Fetch the tool list of a single MCP server by connecting to it directly with
 * the official MCP client SDK and calling the standard `tools/list` request.
 *
 * Why not the CLI? `claude mcp get/list` report status + transport only — they
 * never expose a server's tools. There is no official `claude` command for this
 * (verified against CLI 2.1.x), so the CLI-equivalent of "what tools does this
 * server expose?" is to speak the open MCP protocol ourselves. The SDK
 * (`@modelcontextprotocol/sdk`, MIT, vendor-neutral) is a client for that open
 * standard — it does NOT route through Claude's API/account/policy, so this
 * stays within the "no Claude-SDK / no undocumented protocol" rule in CLAUDE.md.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { McpTransportType } from '../../shared';
import type { McpServerTool, McpServerConfig } from '../../shared';

/** Hard ceiling for a connect + list round-trip, so a hung server can't wedge the UI. */
const TOOLS_TIMEOUT_MS = 15_000;

/** Shape of a single tool as returned by the SDK's `listTools()` (subset we use). */
interface RawMcpTool {
  name: string;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
  };
}

/**
 * Map a raw SDK tool to our wire shape. Only carries the annotation flags the UI
 * renders; omits the `annotations` object entirely when neither hint is present
 * so the WebView's `tool.annotations?.readOnly` checks stay falsy. Pure.
 */
export function mapMcpTool(tool: RawMcpTool): McpServerTool {
  const { readOnlyHint, destructiveHint } = tool.annotations ?? {};
  if (readOnlyHint === undefined && destructiveHint === undefined) {
    return { name: tool.name };
  }
  const annotations: NonNullable<McpServerTool['annotations']> = {};
  if (readOnlyHint !== undefined) annotations.readOnly = readOnlyHint;
  if (destructiveHint !== undefined) annotations.destructive = destructiveHint;
  return { name: tool.name, annotations };
}

/**
 * Build the SDK transport for a server config, or null when the transport can't
 * be probed directly (claudeai-proxy needs OAuth; ws is rare; missing url/cmd).
 */
export function buildTransport(config: McpServerConfig): Transport | null {
  switch (config.type) {
    case McpTransportType.STDIO:
      if (!config.command) return null;
      return new StdioClientTransport({
        command: config.command,
        args: config.args ?? [],
        // stdio transports do NOT inherit env by default (SDK security choice);
        // pass the backend's env so `npx`/`node` resolve via PATH, then layer
        // the server's own env overrides on top.
        env: stdioEnv(config.env),
      });
    case McpTransportType.HTTP:
      if (!config.url) return null;
      return new StreamableHTTPClientTransport(new URL(config.url), {
        requestInit: config.headers ? { headers: config.headers } : undefined,
      });
    case McpTransportType.SSE:
      if (!config.url) return null;
      return new SSEClientTransport(new URL(config.url), {
        requestInit: config.headers ? { headers: config.headers } : undefined,
      });
    default:
      return null;
  }
}

/** process.env with undefined values stripped, merged with per-server overrides. */
function stdioEnv(overrides?: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = {};
  for (const [key, val] of Object.entries(process.env)) {
    if (val !== undefined) base[key] = val;
  }
  return { ...base, ...(overrides ?? {}) };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * Connect to a single MCP server (by its config) and return its tools. Returns
 * an empty array for transports that can't be probed directly (e.g. claude.ai
 * connectors) or a null config. Throws on connection/protocol failure so the
 * caller can surface the reason.
 */
export async function fetchServerTools(config: McpServerConfig | null): Promise<McpServerTool[]> {
  if (!config) return [];
  const transport = buildTransport(config);
  if (!transport) return [];

  const client = new Client({ name: 'claude-code-gui', version: '1.0.0' });
  try {
    await withTimeout(client.connect(transport), TOOLS_TIMEOUT_MS, 'MCP connect');
    const result = await withTimeout(client.listTools(), TOOLS_TIMEOUT_MS, 'MCP tools/list');
    return result.tools.map(mapMcpTool);
  } finally {
    await client.close().catch(() => { /* best-effort cleanup */ });
  }
}
