/**
 * Pick the launcher cmd.exe would ACTUALLY execute from the output of
 * `where <cmd>` on win32.
 *
 * ## Why this exists
 *
 * `where claude` lists every match in PATH order, INCLUDING the extension-less
 * shell script (e.g. `...\npm\claude`, the MSYS/bash wrapper npm ships alongside
 * `claude.cmd`). cmd.exe never runs that extension-less file — it resolves a bare
 * `claude` through PATHEXT (`.COM;.EXE;.BAT;.CMD;...`). So taking the first line
 * of `where` output points at a file that is NOT what actually runs. That desyncs
 * everything derived from it (install-method detection, the update target) from
 * the binary the backend actually spawns. Choosing the first line whose extension
 * is in PATHEXT restores that agreement.
 *
 * `where` already prints matches in PATH-directory order, so the first
 * PATHEXT-matching line corresponds to the directory cmd.exe reaches first. This
 * is a close model of cmd.exe resolution; the only unmodelled case is multiple
 * executable extensions for `claude` inside a SINGLE directory (e.g. both
 * `claude.exe` and `claude.cmd` there), which does not occur for the launchers we
 * drive.
 *
 * Falls back to the first line when no line carries a PATHEXT extension (unusual —
 * e.g. a bare executable with no extension). Returns null for empty output.
 */
export function pickWin32Launcher(
  whereStdout: string,
  pathext: string = process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD',
): string | null {
  const lines = whereStdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return null;

  const exts = pathext
    .split(';')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

  const withExt = lines.find((line) => {
    const dot = line.lastIndexOf('.');
    if (dot < 0) return false;
    return exts.includes(line.slice(dot).toLowerCase());
  });

  return withExt ?? lines[0];
}
