/**
 * True when [p] is a WSL UNC path (`\\wsl.localhost\...` or legacy `\\wsl$\...`).
 *
 * Used to detect a WSL project opened from a Windows-native backend (Standalone
 * mode launched from a Windows shell), where spawning claude with the UNC path as
 * cwd fails ("UNC paths are not supported" via cmd.exe) and the CLI would pick the
 * PowerShell tool instead of bash. In JetBrains mode the backend runs inside the
 * distro (platform === 'linux'), so this never trips there. See issue #57.
 */
export function isWslUncPath(p: string | undefined | null): boolean {
  if (!p) return false;
  const n = p.replace(/\\/g, '/').toLowerCase();
  return n.startsWith('//wsl.localhost/') || n.startsWith('//wsl$/');
}

/** A WSL location parsed out of a Windows UNC path: which distro, and where inside it. */
export interface WslLocation {
  distro: string;
  linuxPath: string;
}

/**
 * Parse a WSL UNC path into its distro and inner Linux path. Mirror of the Kotlin
 * `WslPathResolver.parseUncPath` so both ends agree on the conversion.
 *
 * `\\wsl.localhost\Ubuntu\home\user\proj` -> { distro: "Ubuntu", linuxPath: "/home/user/proj" }
 * `\\wsl$\NixOS\home\maicol07`            -> { distro: "NixOS", linuxPath: "/home/maicol07" }
 * `\\wsl.localhost\Ubuntu`                -> { distro: "Ubuntu", linuxPath: "/" }
 *
 * Returns null when [uncPath] is not a WSL UNC path. The distro keeps its original
 * casing (ids are case-sensitive to `wsl -d`); only the host prefix is matched
 * case-insensitively.
 */
export function parseUncPath(uncPath: string | undefined | null): WslLocation | null {
  if (!isWslUncPath(uncPath)) return null;
  const normalized = (uncPath as string).replace(/\\/g, '/');

  // Drop the leading "//<host>/", preserving the original casing of the distro id.
  const afterSlashes = normalized.substring(2); // strip leading "//"
  const firstSlash = afterSlashes.indexOf('/');
  if (firstSlash < 0) return null;
  const rest = afterSlashes.substring(firstSlash + 1); // "Ubuntu/home/user/proj"

  const segments = rest.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return null;

  const distro = segments[0];
  const linuxSegments = segments.slice(1);
  const linuxPath = linuxSegments.length === 0 ? '/' : '/' + linuxSegments.join('/');
  return { distro, linuxPath };
}

/**
 * Convert a Windows-side path to the path WSL sees. Mirror of the Kotlin
 * `WslPathResolver.toWslPath`.
 *
 * - Already a Linux path (`/home/...`)      -> returned unchanged.
 * - WSL UNC (`\\wsl.localhost\Ubuntu\home`) -> the Linux path inside the distro (`/home`).
 * - Drive path (`C:\Users\foo`)             -> `/mnt/c/Users/foo`.
 * - Anything else                           -> back-slashes turned into forward-slashes.
 *
 * Returns the input unchanged for null/undefined/blank.
 */
export function toWslPath(windowsPath: string | undefined | null): string | null | undefined {
  if (windowsPath == null) return windowsPath;
  if (windowsPath.trim() === '') return windowsPath;

  // WSL UNC path -> the path inside the distro. Checked BEFORE the leading-slash
  // short-circuit below: a forward-slashed UNC (`//wsl.localhost/...`) — the exact
  // form the IDE hands the backend — also starts with '/', so a naive linux-path
  // check would wrongly return it unchanged and the cwd fix would be a no-op (#57).
  const loc = parseUncPath(windowsPath);
  if (loc) return loc.linuxPath;

  // Already a Linux absolute path — nothing to convert.
  if (windowsPath.startsWith('/')) return windowsPath;

  // Drive-letter path: "C:\Users\foo" or "C:Users\foo" -> "/mnt/c/Users/foo".
  if (windowsPath.length >= 2 && windowsPath[1] === ':') {
    const drive = windowsPath[0].toLowerCase();
    const rest = windowsPath.substring(2).replace(/\\/g, '/');
    const withLeadingSlash = rest.startsWith('/') ? rest : '/' + rest;
    const full = `/mnt/${drive}${withLeadingSlash}`.replace(/\/+$/, '');
    return full || `/mnt/${drive}`;
  }

  // Fallback: normalize separators.
  return windowsPath.replace(/\\/g, '/');
}

/**
 * Translate a spawn/exec cwd to the path the child will actually see, for a WSL
 * backend. In a WSL backend (running inside the distro, platform === 'linux') the
 * IDE hands the project root as a Windows UNC path (`//wsl.localhost/Ubuntu/...`),
 * which does not exist inside the distro — spawning with it as cwd fails with
 * `spawn ... ENOENT` (the *cwd*, not the binary, is missing). Convert it to the
 * inner Linux path. A no-op off-linux or for non-UNC paths. Issue #57.
 *
 * Accepts string | URL | undefined so it drops straight into a child_process
 * `cwd` option; a URL (or any non-string) is returned unchanged.
 */
export function resolveWslCwd(cwd: string | URL | undefined): string | URL | undefined {
  if (process.platform === 'linux' && typeof cwd === 'string' && isWslUncPath(cwd)) {
    return toWslPath(cwd) ?? cwd;
  }
  return cwd;
}
