import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { Claude } from '../claude';
import { parseMcpList, parseMcpGet } from './mcp-parser';
import { McpServerStatus, McpServerScope } from '../../shared';
import type { McpServer, McpServersResult } from '../../shared';

// ─── Path helpers ─────────────────────────────────────────────────────────────

/** Path to the global claude config file that stores disabledMcpServers. */
function claudeJsonPath(): string {
  return join(process.env.CLAUDE_CONFIG_DIR ?? homedir(), '.claude.json');
}

/**
 * Display form of the global config path, shown next to the user/local scope
 * groups in the UI. Resolves to `~/.claude.json` normally, or the absolute
 * `$CLAUDE_CONFIG_DIR/.claude.json` when that env var overrides the home dir —
 * so the displayed source path always matches where `claude mcp add` writes.
 */
export function claudeJsonDisplayPath(): string {
  const dir = process.env.CLAUDE_CONFIG_DIR;
  return dir ? join(dir, '.claude.json') : '~/.claude.json';
}

async function readClaudeJson(): Promise<Record<string, unknown>> {
  try {
    const p = claudeJsonPath();
    if (!existsSync(p)) return {};
    return JSON.parse(await readFile(p, 'utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writeClaudeJson(data: Record<string, unknown>): Promise<void> {
  const p = claudeJsonPath();
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ─── Scope ordering for stable list rendering ──────────────────────────────────

const SCOPE_ORDER: string[] = ['project', 'local', 'user', 'claudeai', 'managed', 'enterprise'];

function scopeRank(scope: McpServerScope | string): number {
  const i = SCOPE_ORDER.indexOf(scope as string);
  return i === -1 ? 99 : i;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch all MCP servers with status, scope, config, and disabled state.
 *
 * Strategy (CLI-first, per CLAUDE.md):
 *   1. `claude mcp list` → names + basic status (performs health check)
 *   2. `claude mcp get <name>` in parallel → full details per server
 *   3. Read disabledMcpServers from ~/.claude.json → mark DISABLED
 *
 * Servers are sorted by scope priority then name.
 */
export async function getMcpServers(): Promise<McpServersResult> {
  const [listOut, disabled] = await Promise.all([runMcpList(), readDisabledServers()]);
  const names = parseMcpList(listOut).map((s) => s.name);

  if (names.length === 0 && disabled.length === 0) {
    return { servers: [], configPath: claudeJsonDisplayPath() };
  }

  // Fetch details for all connected/failed servers in parallel.
  const settled = await Promise.allSettled(names.map((name) => fetchServerDetails(name)));

  const servers: McpServer[] = settled.flatMap((r) => {
    if (r.status === 'fulfilled' && r.value !== null) return [r.value];
    return [];
  });

  // Apply disabled state. `claude mcp list` does NOT honour disabledMcpServers —
  // it still reports those servers (and health-checks them), so their status must
  // be overridden to DISABLED here, plus synthetic entries for config-only ones.
  await mergeDisabledServers(servers, disabled, fetchServerDetails);

  servers.sort((a, b) => {
    const scopeDiff = scopeRank(a.scope) - scopeRank(b.scope);
    if (scopeDiff !== 0) return scopeDiff;
    return a.name.localeCompare(b.name);
  });

  return { servers, configPath: claudeJsonDisplayPath() };
}

/**
 * Override the status of servers in the `disabledMcpServers` list to DISABLED.
 *
 * `claude mcp list` ignores `disabledMcpServers` and still reports those servers
 * with their live status (usually FAILED, since a disabled server isn't running),
 * so a disabled server would otherwise render as "Failed" and offer no way back.
 * For servers the CLI didn't report at all (config-only), a synthetic entry is
 * fetched and added. Mutates and returns `servers`.
 */
export async function mergeDisabledServers(
  servers: McpServer[],
  disabled: string[],
  fetchDetails: (name: string) => Promise<McpServer | null>,
): Promise<McpServer[]> {
  for (const disabledName of disabled) {
    const existing = servers.find((s) => s.name === disabledName);
    if (existing) {
      existing.status = McpServerStatus.DISABLED;
      existing.error = null;
    } else {
      const details = await fetchDetails(disabledName).catch(() => null);
      servers.push({
        ...(details ?? {
          name: disabledName,
          scope: McpServerScope.USER,
          config: null,
          tools: [],
        }),
        status: McpServerStatus.DISABLED,
        error: null,
      });
    }
  }
  return servers;
}

/**
 * Re-fetch a single server's details (used as a "reconnect" health-check).
 * `claude mcp get` tries to connect when invoked, so re-running it is the
 * CLI-equivalent of a reconnect probe.
 */
export async function reconnectMcpServer(name: string): Promise<McpServer | null> {
  return fetchServerDetails(name);
}

/**
 * Toggle the enabled/disabled state of a named MCP server.
 * Edits the `disabledMcpServers` array in ~/.claude.json.
 * (No CLI command exists for this — CLI users also edit the file directly.)
 */
export async function setMcpServerEnabled(name: string, enabled: boolean): Promise<void> {
  const data = await readClaudeJson();
  const current: string[] = Array.isArray(data.disabledMcpServers)
    ? (data.disabledMcpServers as string[])
    : [];

  const updated = enabled
    ? current.filter((n) => n !== name)
    : current.includes(name) ? current : [...current, name];

  await writeClaudeJson({ ...data, disabledMcpServers: updated });
}

/**
 * Add a new MCP server via `claude mcp add-json`.
 * @param scope  One of: user | project | local
 */
export async function addMcpServer(
  name: string,
  config: Record<string, unknown>,
  scope: string,
): Promise<void> {
  const json = JSON.stringify(config);
  const scopeFlag = scopeCliFlag(scope);
  const args = ['mcp', 'add-json', name, json];
  if (scopeFlag) args.push('-s', scopeFlag);
  const { stdout, stderr } = await Claude.exec(args, { timeout: 15000 });
  const combined = `${stdout}\n${stderr}`.toLowerCase();
  if (combined.includes('error') && !combined.includes('already exists')) {
    throw new Error(`claude mcp add-json failed: ${stderr || stdout}`);
  }
}

/**
 * Remove a named MCP server via `claude mcp remove`.
 */
export async function removeMcpServer(name: string, scope: string): Promise<void> {
  const scopeFlag = scopeCliFlag(scope);
  const args = ['mcp', 'remove', name];
  if (scopeFlag) args.push('-s', scopeFlag);
  const { stderr } = await Claude.exec(args, { timeout: 10000 });
  if (stderr.toLowerCase().includes('error')) {
    throw new Error(`claude mcp remove failed: ${stderr}`);
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function runMcpList(): Promise<string> {
  try {
    const { stdout } = await Claude.exec(['mcp', 'list'], { timeout: 20000 });
    return stdout;
  } catch {
    return '';
  }
}

async function fetchServerDetails(name: string): Promise<McpServer | null> {
  try {
    const { stdout } = await Claude.exec(['mcp', 'get', name], { timeout: 12000 });
    const server = parseMcpGet(stdout);
    if (!server) return null;
    return await enrichWithProbeError(server);
  } catch {
    return null;
  }
}

/**
 * For SSE/HTTP servers in a failed/auth-required state, probe the URL directly
 * to surface a richer error message (e.g. ECONNREFUSED, HTTP 4xx/5xx).
 * CLI only reports "Failed to connect"; this gives us the actual cause.
 */
async function enrichWithProbeError(server: McpServer): Promise<McpServer> {
  if (
    (server.status === McpServerStatus.FAILED || server.status === McpServerStatus.NEEDS_AUTH) &&
    server.config &&
    'url' in server.config &&
    typeof server.config.url === 'string'
  ) {
    const probeError = await probeUrl(server.config.url);
    if (probeError) return { ...server, error: probeError };
  }
  return server;
}

async function probeUrl(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'text/event-stream, application/json, */*' },
    });
    clearTimeout(timer);
    if (!res.ok) return `HTTP ${res.status} ${res.statusText}`;
    return null;
  } catch (err: unknown) {
    clearTimeout(timer);
    if (!(err instanceof Error)) return 'Connection failed';
    if (err.name === 'AbortError') return `Connection timed out. Is the server running at ${url}?`;

    // Node.js fetch wraps low-level errors in a TypeError with a `cause`.
    // cause can be AggregateError (ECONNREFUSED) where message is empty — check code too.
    const cause = (err as { cause?: { message?: string; code?: string } }).cause;
    const causeCode = cause?.code ?? '';
    const detail = (cause?.message || '').trim() || err.message;

    if (causeCode === 'ECONNREFUSED' || detail.includes('ECONNREFUSED')) {
      return `Unable to connect: connection refused. Is the server running at ${url}?`;
    }
    if (causeCode === 'ENOTFOUND' || detail.includes('ENOTFOUND') || detail.includes('getaddrinfo')) {
      return `Unable to connect: hostname not found. Is the URL correct? (${url})`;
    }
    return detail || 'Connection failed';
  }
}

async function readDisabledServers(): Promise<string[]> {
  const data = await readClaudeJson();
  return Array.isArray(data.disabledMcpServers) ? (data.disabledMcpServers as string[]) : [];
}

/** Map our scope string to the -s flag value the CLI accepts. */
function scopeCliFlag(scope: string): string | null {
  switch (scope) {
    case 'user': return 'user';
    case 'project': return 'project';
    case 'local': return 'local';
    default: return null;
  }
}
