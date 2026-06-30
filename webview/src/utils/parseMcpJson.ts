/**
 * Smart parser for the "Add MCP Server" paste box.
 *
 * Accepts the two JSON shapes users actually copy from the wild and normalises
 * them into a list of { name, config } pairs ready for `claude mcp add-json`:
 *
 *   1. Wrapper form (`.mcp.json` / Claude Desktop config) — name lives in the key:
 *        { "mcpServers": { "my-server": { "command": "npx", "args": [...] } } }
 *      May hold several servers; each becomes its own entry. nameFallback is ignored.
 *
 *   2. Inner config form — a single server config with no wrapper:
 *        { "command": "npx", "args": [...] }   or   { "type": "http", "url": "..." }
 *      The name comes from nameFallback (the form's Name field), which is required here.
 *
 * Per the project's原본 보존 원칙, the config object is passed through VERBATIM —
 * no key renaming, no `type` injection. Validation only checks that each config
 * carries a `command` (stdio) or a `url` (remote); the CLI is the final arbiter.
 */

export interface ParsedMcpServer {
  name: string;
  config: Record<string, unknown>;
}

export type ParseMcpJsonResult =
  | { ok: true; servers: ParsedMcpServer[] }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A config is installable only if it has a stdio `command` or a remote `url`. */
function hasInstallTarget(config: Record<string, unknown>): boolean {
  const hasCommand = typeof config.command === 'string' && config.command.trim().length > 0;
  const hasUrl = typeof config.url === 'string' && config.url.trim().length > 0;
  return hasCommand || hasUrl;
}

export function parseMcpJson(rawText: string, nameFallback: string): ParseMcpJsonResult {
  const text = rawText.trim();
  if (!text) {
    return { ok: false, error: 'Paste a JSON config to add a server.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Invalid JSON: ${detail}` };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, error: 'Expected a JSON object (an mcpServers wrapper or a single server config).' };
  }

  // Form 1: mcpServers wrapper.
  if (isPlainObject(parsed.mcpServers)) {
    const entries = Object.entries(parsed.mcpServers);
    if (entries.length === 0) {
      return { ok: false, error: 'The "mcpServers" object is empty — no servers to add.' };
    }
    const servers: ParsedMcpServer[] = [];
    for (const [name, config] of entries) {
      if (!isPlainObject(config)) {
        return { ok: false, error: `Server "${name}" is not a JSON object.` };
      }
      if (!hasInstallTarget(config)) {
        return { ok: false, error: `Server "${name}" needs a "command" (stdio) or "url" (remote).` };
      }
      servers.push({ name, config });
    }
    return { ok: true, servers };
  }

  // Form 2: bare inner config — name comes from the Name field.
  const name = nameFallback.trim();
  if (!name) {
    return { ok: false, error: 'Name is required when pasting a single server config (no "mcpServers" wrapper).' };
  }
  if (!hasInstallTarget(parsed)) {
    return { ok: false, error: 'Config needs a "command" (stdio) or "url" (remote).' };
  }
  return { ok: true, servers: [{ name, config: parsed }] };
}
