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
