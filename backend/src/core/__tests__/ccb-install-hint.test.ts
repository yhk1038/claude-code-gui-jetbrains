import { describe, it, expect } from 'vitest';
import { ccbInstallHint } from '../ccb-install-hint';

describe('ccbInstallHint', () => {
  it('uses npm.cmd on win32 so it survives the PowerShell execution policy', () => {
    const h = ccbInstallHint('win32');
    expect(h.command).toBe('npm.cmd install -g claude-code-battery');
    expect(h.shells).toEqual(['Command Prompt', 'PowerShell', 'Git Bash']);
  });

  it('uses plain npm in a single terminal on unix', () => {
    for (const p of ['darwin', 'linux'] as NodeJS.Platform[]) {
      const h = ccbInstallHint(p);
      expect(h.command).toBe('npm install -g claude-code-battery');
      expect(h.shells).toEqual(['Terminal']);
    }
  });
});
