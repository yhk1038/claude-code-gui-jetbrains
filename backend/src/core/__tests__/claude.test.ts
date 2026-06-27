import { describe, it, expect, vi, afterEach } from 'vitest';

// We can't easily test Claude class directly because buildAugmentedPath runs
// at class load time. Instead we test the observable behavior.
// For now, test that Claude.command and Claude.env have expected shapes.

// Mock readSettingsFile to avoid file system access
vi.mock('../features/settings', () => ({
  readSettingsFile: vi.fn().mockResolvedValue({ cliPath: null }),
  resolveClaudeConfigDirOverride: vi.fn().mockResolvedValue(null),
}));

// Mock child_process so we can inspect the options passed to spawn/execFile
// without launching a real process.
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({ on: vi.fn() })),
  execFile: vi.fn(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb?: (err: unknown, stdout: string, stderr: string) => void,
    ) => {
      cb?.(null, '{}', '');
      return { on: vi.fn() };
    },
  ),
}));

import { spawn as cpSpawn, execFile as cpExecFile } from 'child_process';
import { Claude } from '../claude';

describe('Claude', () => {
  describe('command', () => {
    it('should default to "claude" when no cliPath is configured', () => {
      expect(Claude.command).toBe('claude');
    });
  });

  describe('env', () => {
    it('should include augmented PATH', () => {
      const env = Claude.env;
      expect(env.PATH).toBeDefined();
      expect(typeof env.PATH).toBe('string');
    });

    it('should preserve existing environment variables', () => {
      const env = Claude.env;
      // Should include all current process env vars
      expect(env.PATH).toBeDefined();
    });
  });

  describe('refresh()', () => {
    const originalConfigDir = process.env.CLAUDE_CONFIG_DIR;

    afterEach(async () => {
      const settings = await import('../features/settings');
      vi.mocked(settings.resolveClaudeConfigDirOverride).mockResolvedValue(null);
      if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = originalConfigDir;
    });

    it('should load settings without throwing', async () => {
      await expect(Claude.refresh()).resolves.not.toThrow();
    });

    it('applies the settings CLAUDE_CONFIG_DIR override onto process.env (#123)', async () => {
      const settings = await import('../features/settings');
      vi.mocked(settings.resolveClaudeConfigDirOverride).mockResolvedValueOnce('/custom/.claude-work');

      await Claude.refresh('/some/project');

      expect(process.env.CLAUDE_CONFIG_DIR).toBe('/custom/.claude-work');
    });
  });

  // Regression for issue #99: on Windows the `claude` launcher is a .cmd/.ps1
  // wrapper that execFile cannot run without a shell, so `claude auth status`
  // (GET_ACCOUNT) failed with ENOENT and the user was stuck on the login screen
  // even while already authenticated. spawn() already ran through a shell on
  // win32; exec() must do the same so the two stay symmetric.
  describe('shell handling across platforms', () => {
    const originalPlatform = process.platform;

    const setPlatform = (value: NodeJS.Platform) => {
      Object.defineProperty(process, 'platform', { value, configurable: true });
    };

    afterEach(() => {
      setPlatform(originalPlatform);
      vi.clearAllMocks();
    });

    it('exec() runs through a shell on win32 (#99)', async () => {
      setPlatform('win32');
      await Claude.exec(['auth', 'status']);
      const opts = vi.mocked(cpExecFile).mock.calls[0]?.[2] as { shell?: boolean };
      expect(opts.shell).toBe(true);
    });

    it('exec() does not force a shell on non-win32', async () => {
      setPlatform('darwin');
      await Claude.exec(['auth', 'status']);
      const opts = vi.mocked(cpExecFile).mock.calls[0]?.[2] as { shell?: boolean };
      expect(opts.shell).toBeFalsy();
    });

    it('exec() honors an explicit shell override', async () => {
      setPlatform('win32');
      await Claude.exec(['auth', 'status'], { shell: false });
      const opts = vi.mocked(cpExecFile).mock.calls[0]?.[2] as { shell?: boolean };
      expect(opts.shell).toBe(false);
    });

    it('spawn() runs through a shell on win32', () => {
      setPlatform('win32');
      Claude.spawn(['auth', 'login', '--claudeai']);
      const opts = vi.mocked(cpSpawn).mock.calls[0]?.[2] as { shell?: boolean };
      expect(opts.shell).toBe(true);
    });
  });
});
