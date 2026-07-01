import {formatMcpToolName, type McpToolNamer} from "./_common";
import {jetBrainsToolNamer} from "./JetBrains/_shared/helpers";

/**
 * Ordered registry of per-family MCP tool namers. Each family (JetBrains, …)
 * contributes exactly ONE {@link McpToolNamer} here — this is the single place
 * that knows about every family. General chat UI (e.g. the permission dialog)
 * calls the dispatchers below and never imports a family's renderer internals,
 * so adding the Nth tool family is one line here, not an `isXxxTool` branch
 * sprinkled through general code.
 */
const NAMERS: McpToolNamer[] = [jetBrainsToolNamer];

function namerFor(name: string): McpToolNamer | undefined {
    return NAMERS.find((n) => n.matches(name));
}

/**
 * Full human label for an MCP tool — used by "Allow <label>?". A family namer
 * wins (JetBrains → "IntelliJ IDEA: Create new file"); otherwise falls back to
 * the generic `formatMcpToolName` ("Gmail [search_threads]"). Never throws.
 */
export function humanizeMcpToolName(name: string): string {
    return namerFor(name)?.label(name) ?? formatMcpToolName(name);
}

/**
 * Phrase for "Yes, allow all <…> this session". A family may offer a shorter
 * scope label (JetBrains → the quoted action only, not the product prefix);
 * otherwise the full generic label is used.
 */
export function mcpToolSessionScopeLabel(name: string): string {
    return namerFor(name)?.sessionScopeLabel(name) ?? formatMcpToolName(name);
}
