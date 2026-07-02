import { describe, it, expect, afterEach } from 'vitest';
import { isPermissionFailure, terminalHint, permissionErrorMessage } from '../updateCli';

describe('isPermissionFailure', () => {
  it('detects the EACCES errno code (npm global write denied)', () => {
    expect(isPermissionFailure('npm ERR! code EACCES\nnpm ERR! syscall mkdir')).toBe(true);
  });

  it('detects the EPERM errno code', () => {
    expect(isPermissionFailure('Error: EPERM: operation not permitted, open ...')).toBe(true);
  });

  it('detects a plain "permission denied" phrasing', () => {
    expect(isPermissionFailure('mkdir: /usr/local/lib: Permission denied')).toBe(true);
  });

  it('detects "operation not permitted"', () => {
    expect(isPermissionFailure('rename: operation not permitted')).toBe(true);
  });

  it('detects a "need sudo" style hint', () => {
    expect(isPermissionFailure('You need sudo to install globally')).toBe(true);
  });

  it('detects "requires administrator"', () => {
    expect(isPermissionFailure('This operation requires administrator privileges')).toBe(true);
  });

  it('is false for an unrelated failure (network, version, etc.)', () => {
    expect(isPermissionFailure('npm ERR! network request to registry failed')).toBe(false);
    expect(isPermissionFailure('No matching version found for @anthropic-ai/claude-code@9.9.9')).toBe(false);
    expect(isPermissionFailure('')).toBe(false);
  });

  it('does not misfire on the substring "supervisor" (word boundary on sudo)', () => {
    expect(isPermissionFailure('supervisor restarted the daemon')).toBe(false);
  });
});

describe('terminalHint', () => {
  it('joins the command and args into a runnable line', () => {
    expect(terminalHint('npm', ['install', '-g', '@anthropic-ai/claude-code@latest']))
      .toBe('npm install -g @anthropic-ai/claude-code@latest');
  });

  it('formats the NATIVE claude update command', () => {
    expect(terminalHint('claude', ['update'])).toBe('claude update');
  });
});

describe('permissionErrorMessage', () => {
  const originalPlatform = process.platform;
  const setPlatform = (value: NodeJS.Platform) =>
    Object.defineProperty(process, 'platform', { value, configurable: true });

  afterEach(() => setPlatform(originalPlatform));

  it('tells the user to run it in a terminal and includes the exact command', () => {
    setPlatform('linux');
    const msg = permissionErrorMessage('npm', ['install', '-g', 'pkg'], 'EACCES');
    expect(msg).toMatch(/terminal/i);
    expect(msg).toContain('npm install -g pkg');
  });

  it('prefixes sudo on non-win32 (a system location needs elevation)', () => {
    setPlatform('darwin');
    const msg = permissionErrorMessage('npm', ['install', '-g', 'pkg'], 'EACCES');
    expect(msg).toContain('sudo npm install -g pkg');
  });

  it('does NOT prefix sudo on win32 (no such concept)', () => {
    setPlatform('win32');
    const msg = permissionErrorMessage('winget', ['upgrade', '--id', 'Anthropic.ClaudeCode', '-e'], 'Access is denied');
    expect(msg).not.toContain('sudo');
    expect(msg).toContain('winget upgrade --id Anthropic.ClaudeCode -e');
  });

  it('embeds the original error when present, and omits the parenthetical when empty', () => {
    setPlatform('linux');
    expect(permissionErrorMessage('npm', ['install', '-g', 'pkg'], 'EACCES: denied'))
      .toContain('(original error: EACCES: denied)');
    expect(permissionErrorMessage('npm', ['install', '-g', 'pkg'], ''))
      .not.toContain('original error');
  });
});
