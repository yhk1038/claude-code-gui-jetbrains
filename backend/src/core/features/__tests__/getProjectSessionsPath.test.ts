import { describe, it, expect, afterEach } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';
import { getProjectSessionsPath, normalizeProjectPath } from '../getProjectSessionsPath';

describe('getProjectSessionsPath', () => {
  describe('data directory resolution', () => {
    const original = process.env.CLAUDE_CONFIG_DIR;

    afterEach(() => {
      if (original === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = original;
    });

    it('resolves under ~/.claude/projects by default', async () => {
      delete process.env.CLAUDE_CONFIG_DIR;
      const result = await getProjectSessionsPath('/home/user/project');
      expect(result).toBe(
        join(homedir(), '.claude', 'projects', '-home-user-project'),
      );
    });

    it('honors a custom CLAUDE_CONFIG_DIR (issue #117)', async () => {
      process.env.CLAUDE_CONFIG_DIR = join('D:', 'Claude');
      const result = await getProjectSessionsPath('/home/user/project');
      expect(result).toBe(
        join('D:', 'Claude', 'projects', '-home-user-project'),
      );
    });
  });

  describe('normalizeProjectPath()', () => {
    it('should replace forward slashes with hyphens', () => {
      expect(normalizeProjectPath('/home/user/project')).toBe('-home-user-project');
    });

    it('should replace backslashes with hyphens', () => {
      expect(normalizeProjectPath('C:\\Users\\admin\\project')).toBe('C--Users-admin-project');
    });

    it('should keep alphanumeric characters unchanged', () => {
      expect(normalizeProjectPath('myProject123')).toBe('myProject123');
    });

    it('should replace spaces with hyphens', () => {
      expect(normalizeProjectPath('/home/user/my project')).toBe('-home-user-my-project');
    });

    it('should replace special characters with hyphens', () => {
      expect(normalizeProjectPath('/home/user/project@v2')).toBe('-home-user-project-v2');
    });

    it('should handle trailing slash', () => {
      expect(normalizeProjectPath('/home/user/project/')).toBe('-home-user-project-');
    });

    it('should handle home directory tilde', () => {
      // tilde is non-alphanumeric, so it's replaced with '-'
      expect(normalizeProjectPath('~/project')).toBe('--project');
    });

    it('should handle dots in path', () => {
      expect(normalizeProjectPath('/home/user/.config/app')).toBe('-home-user--config-app');
    });

    it('should handle empty string', () => {
      expect(normalizeProjectPath('')).toBe('');
    });

    it('should handle path with multiple consecutive special chars', () => {
      expect(normalizeProjectPath('/home//user')).toBe('-home--user');
    });
  });

  // A WSL backend (platform=linux) is handed the project as a Windows UNC path
  // (//wsl.localhost/Ubuntu/home/...), but the claude CLI ran inside the distro and
  // named the sessions dir from the INNER Linux path. Without converting first, the
  // encoded dir name (--wsl-localhost-...) never matches the CLI's (-home-...), so the
  // GUI shows "No sessions yet" despite valid files on disk (#175).
  describe('WSL UNC path on a linux (distro) backend (#175)', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    const originalCfg = process.env.CLAUDE_CONFIG_DIR;

    afterEach(() => {
      if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
      if (originalCfg === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = originalCfg;
    });

    it('converts a WSL UNC workingDir to the inner Linux path before encoding, matching the CLI', async () => {
      delete process.env.CLAUDE_CONFIG_DIR;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      const result = await getProjectSessionsPath('//wsl.localhost/Ubuntu/home/yhk/ccg-test');
      // Must match what the claude CLI wrote (/home/yhk/ccg-test -> -home-yhk-ccg-test),
      // NOT the raw UNC encoding (--wsl-localhost-Ubuntu-home-yhk-ccg-test).
      expect(result).toBe(join(homedir(), '.claude', 'projects', '-home-yhk-ccg-test'));
    });

    it('leaves a normal Linux workingDir unchanged', async () => {
      delete process.env.CLAUDE_CONFIG_DIR;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      const result = await getProjectSessionsPath('/home/yhk/ccg-test');
      expect(result).toBe(join(homedir(), '.claude', 'projects', '-home-yhk-ccg-test'));
    });
  });
});
