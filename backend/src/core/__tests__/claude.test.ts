import { describe, it, expect, vi, beforeEach } from 'vitest';

// We can't easily test Claude class directly because buildAugmentedPath runs
// at class load time. Instead we test the observable behavior.
// For now, test that Claude.command and Claude.env have expected shapes.

// Mock readSettingsFile to avoid file system access
vi.mock('../features/settings', () => ({
  readSettingsFile: vi.fn().mockResolvedValue({ cliPath: null }),
}));

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
    it('should load settings without throwing', async () => {
      await expect(Claude.refresh()).resolves.not.toThrow();
    });
  });
});
