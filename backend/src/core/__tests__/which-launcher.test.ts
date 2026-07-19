import { describe, it, expect } from 'vitest';
import { pickWin32Launcher } from '../which-launcher';

// A representative PATHEXT (Windows default order).
const PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC';

describe('pickWin32Launcher', () => {
  it('skips the extension-less shell script and picks the PATHEXT match in the same dir', () => {
    // `where claude` lists the MSYS/bash script (no extension) BEFORE the .cmd.
    // cmd.exe never runs the extension-less file — it resolves via PATHEXT to .cmd.
    const out = [
      'C:\\Users\\me\\AppData\\Roaming\\npm\\claude',
      'C:\\Users\\me\\AppData\\Roaming\\npm\\claude.cmd',
    ].join('\r\n');
    expect(pickWin32Launcher(out, PATHEXT)).toBe('C:\\Users\\me\\AppData\\Roaming\\npm\\claude.cmd');
  });

  it('respects PATH order across directories — the first executable wins', () => {
    // Two installs (npm then pnpm). npm's dir comes first in PATH, so its .cmd is
    // what cmd.exe actually runs; the pnpm launcher must not be chosen.
    const out = [
      'C:\\Users\\me\\AppData\\Roaming\\npm\\claude',
      'C:\\Users\\me\\AppData\\Roaming\\npm\\claude.cmd',
      'C:\\Users\\me\\AppData\\Local\\pnpm\\claude',
      'C:\\Users\\me\\AppData\\Local\\pnpm\\claude.CMD',
    ].join('\r\n');
    expect(pickWin32Launcher(out, PATHEXT)).toBe('C:\\Users\\me\\AppData\\Roaming\\npm\\claude.cmd');
  });

  it('matches the extension case-insensitively', () => {
    expect(pickWin32Launcher('C:\\tools\\claude.CMD', PATHEXT)).toBe('C:\\tools\\claude.CMD');
  });

  it('falls back to the first line when no line matches PATHEXT', () => {
    const out = ['C:\\weird\\claude', 'C:\\weird\\claude.foo'].join('\r\n');
    expect(pickWin32Launcher(out, PATHEXT)).toBe('C:\\weird\\claude');
  });

  it('ignores blank lines and surrounding whitespace', () => {
    const out = ['', '  C:\\p\\claude  ', 'C:\\p\\claude.cmd', ''].join('\r\n');
    expect(pickWin32Launcher(out, PATHEXT)).toBe('C:\\p\\claude.cmd');
  });

  it('returns null for empty or whitespace-only output', () => {
    expect(pickWin32Launcher('', PATHEXT)).toBeNull();
    expect(pickWin32Launcher('   \r\n  ', PATHEXT)).toBeNull();
  });
});
