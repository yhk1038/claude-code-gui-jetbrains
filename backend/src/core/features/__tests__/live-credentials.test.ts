import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'crypto';

// We need to test the exported functions without touching the real keychain or filesystem.
// The functions under test are pure computations (service name, account name) so no
// mocking of child_process / fs is needed — just env-var manipulation.

// Import AFTER env setup so module-level reads pick up the modified state.
// We use dynamic imports inside each test group to ensure a fresh module for env isolation.

describe('macKeychainService', () => {
  const originalConfigDir = process.env.CLAUDE_CONFIG_DIR;

  afterEach(() => {
    // Restore env after each test
    if (originalConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR;
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalConfigDir;
    }
    vi.resetModules();
  });

  it('returns bare service name when CLAUDE_CONFIG_DIR is not set', async () => {
    delete process.env.CLAUDE_CONFIG_DIR;
    const { macKeychainService } = await import('../live-credentials');
    expect(macKeychainService()).toBe('Claude Code-credentials');
  });

  it('appends sha256(configDir)[0:8] suffix when CLAUDE_CONFIG_DIR is set', async () => {
    const customDir = '/tmp/custom-claude';
    process.env.CLAUDE_CONFIG_DIR = customDir;
    const { macKeychainService } = await import('../live-credentials');

    const expectedHash = createHash('sha256').update(customDir).digest('hex').substring(0, 8);
    const expected = `Claude Code-credentials-${expectedHash}`;
    expect(macKeychainService()).toBe(expected);
  });

  it('uses the CLAUDE_CONFIG_DIR value as-is (no normalisation) for the hash input', async () => {
    // Trailing slash should produce a different hash than without — the function must not
    // normalise the path before hashing, mirroring the CLI exactly.
    const dirWithSlash = '/tmp/custom-claude/';
    const dirWithoutSlash = '/tmp/custom-claude';

    process.env.CLAUDE_CONFIG_DIR = dirWithSlash;
    const { macKeychainService: svcWith } = await import('../live-credentials');
    const resultWith = svcWith();
    vi.resetModules();

    process.env.CLAUDE_CONFIG_DIR = dirWithoutSlash;
    const { macKeychainService: svcWithout } = await import('../live-credentials');
    const resultWithout = svcWithout();

    // The two values must differ because the hash inputs differ.
    expect(resultWith).not.toBe(resultWithout);
  });

  it('uses an empty string as falsy — sets no suffix when CLAUDE_CONFIG_DIR is empty string', async () => {
    // The CLI uses `!process.env.CLAUDE_CONFIG_DIR` which is true for ''.
    process.env.CLAUDE_CONFIG_DIR = '';
    const { macKeychainService } = await import('../live-credentials');
    expect(macKeychainService()).toBe('Claude Code-credentials');
  });
});

describe('macKeychainAccount', () => {
  const originalUser = process.env.USER;

  afterEach(() => {
    if (originalUser === undefined) {
      delete process.env.USER;
    } else {
      process.env.USER = originalUser;
    }
    vi.resetModules();
  });

  it('returns USER verbatim — including spaces — without any filtering', async () => {
    process.env.USER = 'John Smith';
    const { macKeychainAccount } = await import('../live-credentials');
    expect(macKeychainAccount()).toBe('John Smith');
  });

  it('returns USER verbatim for ASCII-only username', async () => {
    process.env.USER = 'alice';
    const { macKeychainAccount } = await import('../live-credentials');
    expect(macKeychainAccount()).toBe('alice');
  });

  it('returns USER verbatim for username with dots and underscores', async () => {
    process.env.USER = 'john.smith_dev';
    const { macKeychainAccount } = await import('../live-credentials');
    expect(macKeychainAccount()).toBe('john.smith_dev');
  });

  it('falls back to "claude-code-user" when USER is empty string', async () => {
    // Empty string is falsy; the function should not return an empty string.
    process.env.USER = '';
    const { macKeychainAccount } = await import('../live-credentials');
    const result = macKeychainAccount();
    // Should be either os.userInfo().username or the final fallback — never empty.
    expect(result).toBeTruthy();
    // If userInfo().username is also empty/throws, we get the fallback literal.
    // We cannot assert which branch runs here (os.userInfo is the real one),
    // but we can assert the result is non-empty.
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('falls back away from empty string — never returns empty', async () => {
    process.env.USER = '';
    const { macKeychainAccount } = await import('../live-credentials');
    const result = macKeychainAccount();
    expect(result).not.toBe('');
  });
});
