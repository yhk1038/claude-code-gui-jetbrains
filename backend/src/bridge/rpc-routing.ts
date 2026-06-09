/**
 * Routing helpers that pick the correct IDE RPC client when several IDE hosts
 * (separate JVMs — e.g. WebStorm + RubyMine) share the single app-level Node.js
 * backend. Each IDE registers the project roots it serves; an outgoing RPC is
 * routed to the client whose root best matches the request's path/workingDir.
 *
 * Kept as pure functions so the selection logic is unit-testable without a live
 * WebSocket. See JetBrainsBridge for the stateful wiring.
 */

// macOS and Windows file systems are case-insensitive; Linux is case-sensitive.
const CASE_INSENSITIVE_FS = process.platform === 'darwin' || process.platform === 'win32';

/**
 * Normalize a path for prefix comparison: backslashes → forward slashes, trailing
 * slashes trimmed, and lowercased on case-insensitive file systems.
 */
export function normalizePathForMatch(p: string): string {
  const slashFixed = p.replace(/\\/g, '/').replace(/\/+$/, '');
  return CASE_INSENSITIVE_FS ? slashFixed.toLowerCase() : slashFixed;
}

/**
 * True if [path] equals or is nested under [base], compared at segment boundaries
 * so that `/foo` does not match `/foobar/x`. An empty base never matches.
 */
export function pathIsUnder(path: string, base: string): boolean {
  const nb = normalizePathForMatch(base);
  if (nb === '') return false;
  const np = normalizePathForMatch(path);
  return np === nb || np.startsWith(nb + '/');
}

/**
 * Pull the routable path out of a JSON-RPC request's params. Most IDE-bound
 * methods carry one of these keys (filePath / path / workingDir / paths[]);
 * methods that don't (OPEN_URL, PICK_FILES, UPDATE_PLUGIN…) return undefined and
 * fall back to the first available client.
 */
export function extractRoutingPath(params: Record<string, unknown>): string | undefined {
  for (const key of ['filePath', 'path', 'workingDir'] as const) {
    const v = params[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  const paths = params['paths'];
  if (Array.isArray(paths)) {
    const first = paths.find((p) => typeof p === 'string' && p.length > 0);
    if (typeof first === 'string') return first;
  }
  return undefined;
}

export interface RpcClientRouting {
  roots: string[];
  isOpen: boolean;
}

/**
 * Choose which RPC client should receive a request.
 *
 * - Closed clients are never selected.
 * - With no routingPath, the first open client is used (single-IDE behaviour).
 * - With a routingPath, the open client whose registered root is the longest
 *   prefix of the path wins (correct for nested projects).
 * - If the path matches no registered root, fall back to the first open client
 *   so a freshly-connected IDE that hasn't registered yet still works.
 *
 * Returns the index into [entries], or -1 when no open client exists.
 */
export function selectRpcClientIndex(
  entries: RpcClientRouting[],
  routingPath: string | undefined,
): number {
  let firstOpen = -1;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].isOpen) {
      firstOpen = i;
      break;
    }
  }
  if (firstOpen === -1) return -1;
  if (!routingPath) return firstOpen;

  let best = -1;
  let bestLen = -1;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry.isOpen) continue;
    for (const root of entry.roots) {
      if (pathIsUnder(routingPath, root)) {
        const len = normalizePathForMatch(root).length;
        if (len > bestLen) {
          bestLen = len;
          best = i;
        }
      }
    }
  }
  return best >= 0 ? best : firstOpen;
}
