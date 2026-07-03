import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to mock fs modules to test readSettingsFile and saveSettingToFile
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// We must access internal functions. Since validateSetting and generateSettingsContent
// are not exported, we test them indirectly through saveSettingToFile and readSettingsFile.
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import {
  readSettingsFile,
  saveSettingToFile,
  readMergedSettings,
  resolveClaudeConfigDirOverride,
  saveEnvVarToScope,
} from '../settings';

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);
const mockExistsSync = vi.mocked(existsSync);

describe('settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveSettingToFile() - validates settings via validateSetting()', () => {
    beforeEach(() => {
      // Make readSettingsFile return defaults for save operations
      mockExistsSync.mockReturnValue(false);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);
    });

    it('should reject unknown settings key', async () => {
      const result = await saveSettingToFile('unknownKey', 'value');
      expect(result.status).toBe('error');
      expect(result.error).toContain('Unknown settings key');
    });

    it('should reject invalid theme value', async () => {
      const result = await saveSettingToFile('theme', 'invalid');
      expect(result.status).toBe('error');
      expect(result.error).toContain('theme must be one of');
    });

    it('should accept valid theme values', async () => {
      for (const theme of ['system', 'light', 'dark']) {
        const result = await saveSettingToFile('theme', theme);
        expect(result.status).toBe('ok');
      }
    });

    it('should reject fontSize out of range', async () => {
      const tooSmall = await saveSettingToFile('fontSize', 7);
      expect(tooSmall.status).toBe('error');
      expect(tooSmall.error).toContain('fontSize must be an integer between 8 and 32');

      const tooLarge = await saveSettingToFile('fontSize', 33);
      expect(tooLarge.status).toBe('error');
    });

    it('should reject non-integer fontSize', async () => {
      const result = await saveSettingToFile('fontSize', 12.5);
      expect(result.status).toBe('error');
    });

    it('should accept valid fontSize', async () => {
      const result = await saveSettingToFile('fontSize', 16);
      expect(result.status).toBe('ok');
    });

    it('should reject non-boolean debugMode', async () => {
      const result = await saveSettingToFile('debugMode', 'true');
      expect(result.status).toBe('error');
      expect(result.error).toContain('must be a boolean');
    });

    it('should accept boolean debugMode', async () => {
      const result = await saveSettingToFile('debugMode', true);
      expect(result.status).toBe('ok');
    });

    it('should reject invalid logLevel', async () => {
      const result = await saveSettingToFile('logLevel', 'verbose');
      expect(result.status).toBe('error');
      expect(result.error).toContain('logLevel must be one of');
    });

    it('should accept valid logLevel values', async () => {
      for (const level of ['debug', 'info', 'warn', 'error']) {
        const result = await saveSettingToFile('logLevel', level);
        expect(result.status).toBe('ok');
      }
    });

    it('should accept null cliPath', async () => {
      const result = await saveSettingToFile('cliPath', null);
      expect(result.status).toBe('ok');
    });

    it('should accept string cliPath', async () => {
      const result = await saveSettingToFile('cliPath', '/usr/bin/claude');
      expect(result.status).toBe('ok');
    });

    it('should reject non-string non-null cliPath', async () => {
      const result = await saveSettingToFile('cliPath', 123);
      expect(result.status).toBe('error');
      expect(result.error).toContain('cliPath must be a string or null');
    });

    it('should accept null terminalApp', async () => {
      const result = await saveSettingToFile('terminalApp', null);
      expect(result.status).toBe('ok');
    });

    it('should reject non-string non-null terminalApp', async () => {
      const result = await saveSettingToFile('terminalApp', 42);
      expect(result.status).toBe('error');
      expect(result.error).toContain('terminalApp must be a string or null');
    });

    it('should accept null nodePath', async () => {
      const result = await saveSettingToFile('nodePath', null);
      expect(result.status).toBe('ok');
    });

    it('should accept string nodePath', async () => {
      const result = await saveSettingToFile('nodePath', '/usr/bin/node');
      expect(result.status).toBe('ok');
    });

    it('should reject non-string non-null nodePath', async () => {
      const result = await saveSettingToFile('nodePath', 123);
      expect(result.status).toBe('error');
      expect(result.error).toContain('nodePath must be a string or null');
    });

    it('should accept valid hostMode values', async () => {
      for (const mode of ['editor-tab', 'tool-window']) {
        const result = await saveSettingToFile('hostMode', mode);
        expect(result.status).toBe('ok');
      }
    });

    it('should reject invalid hostMode value', async () => {
      const result = await saveSettingToFile('hostMode', 'sidebar');
      expect(result.status).toBe('error');
      expect(result.error).toContain('hostMode must be one of');
    });

    it('should accept an env object of string values', async () => {
      const result = await saveSettingToFile('env', { CLAUDE_CONFIG_DIR: '/home/u/.claude-work' });
      expect(result.status).toBe('ok');
    });

    it('should accept an empty env object', async () => {
      const result = await saveSettingToFile('env', {});
      expect(result.status).toBe('ok');
    });

    it('should reject env that is not an object', async () => {
      const result = await saveSettingToFile('env', 'CLAUDE_CONFIG_DIR=/x');
      expect(result.status).toBe('error');
      expect(result.error).toContain('env must be an object');
    });

    it('should reject env that is an array', async () => {
      const result = await saveSettingToFile('env', ['/x']);
      expect(result.status).toBe('error');
      expect(result.error).toContain('env must be an object');
    });

    it('should reject env with a non-string value', async () => {
      const result = await saveSettingToFile('env', { CLAUDE_CONFIG_DIR: 123 });
      expect(result.status).toBe('error');
      expect(result.error).toContain('must be a string');
    });
  });

  describe('readSettingsFile()', () => {
    it('should return defaults and create file when settings file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await readSettingsFile();

      expect(result).toEqual({
        cliPath: null,
        nodePath: null,
        theme: 'system',
        fontSize: 13,
        autoScrollThreshold: 80,
        debugMode: false,
        logLevel: 'info',
        terminalApp: null,
        hostMode: 'editor-tab',
        openSettingsAs: 'overlay',
        chatPagination: true,
        env: {},
      });
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should parse JS settings file with export default and comments', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(`
// GUI Settings
export default {
  // Claude CLI 실행 파일 경로
  cliPath: null,
  // 테마
  theme: "dark",
  fontSize: 16,
  debugMode: true,
  logLevel: "debug",
  terminalApp: null,
};
`);

      const result = await readSettingsFile();

      expect(result.theme).toBe('dark');
      expect(result.fontSize).toBe(16);
      expect(result.debugMode).toBe(true);
      expect(result.logLevel).toBe('debug');
    });

    it('should handle file with block comments', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(`
/* Multi-line
   block comment */
export default {
  theme: "light",
  fontSize: 14,
};
`);

      const result = await readSettingsFile();
      expect(result.theme).toBe('light');
      expect(result.fontSize).toBe(14);
    });

    it('should merge parsed values with defaults for missing keys', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(`export default { theme: "dark" };`);

      const result = await readSettingsFile();
      expect(result.theme).toBe('dark');
      expect(result.fontSize).toBe(13); // default
      expect(result.debugMode).toBe(false); // default
    });

    it('should return defaults on parse error', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue('completely invalid content !!!');

      const result = await readSettingsFile();
      expect(result).toEqual({
        cliPath: null,
        nodePath: null,
        theme: 'system',
        fontSize: 13,
        autoScrollThreshold: 80,
        debugMode: false,
        logLevel: 'info',
        terminalApp: null,
        hostMode: 'editor-tab',
        openSettingsAs: 'overlay',
        chatPagination: true,
        env: {},
      });
    });

    it('should parse an env object from the settings file', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(
        `export default { env: { CLAUDE_CONFIG_DIR: "/home/u/.claude-work" } };`,
      );

      const result = await readSettingsFile();
      expect(result.env).toEqual({ CLAUDE_CONFIG_DIR: '/home/u/.claude-work' });
    });

    it('should handle trailing commas in JS object', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(`export default {
  theme: "dark",
  fontSize: 14,
};`);

      const result = await readSettingsFile();
      expect(result.theme).toBe('dark');
      expect(result.fontSize).toBe(14);
    });
  });

  describe('env merge and resolution', () => {
    beforeEach(() => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);
      mockExistsSync.mockReturnValue(true);
    });

    // global lives in ~/.claude-code-gui/settings.js, project in
    // <proj>/.claude-code-gui/settings.json — route the mock by file extension.
    function mockGlobalAndProjectEnv(globalEnv: unknown, projectEnv: unknown) {
      mockReadFile.mockImplementation((async (p: string) => {
        if (String(p).endsWith('.js')) {
          return `export default { env: ${JSON.stringify(globalEnv)} };`;
        }
        return JSON.stringify({ env: projectEnv });
      }) as unknown as typeof readFile);
    }

    it('deep-merges env: project keys override global, other global keys preserved', async () => {
      mockGlobalAndProjectEnv(
        { A: 'g', CLAUDE_CONFIG_DIR: '/global' },
        { CLAUDE_CONFIG_DIR: '/project' },
      );

      const { settings } = await readMergedSettings('/proj');
      expect(settings.env).toEqual({ A: 'g', CLAUDE_CONFIG_DIR: '/project' });
    });

    it('resolveClaudeConfigDirOverride prefers project over global', async () => {
      mockGlobalAndProjectEnv(
        { CLAUDE_CONFIG_DIR: '/global' },
        { CLAUDE_CONFIG_DIR: '/project' },
      );

      const value = await resolveClaudeConfigDirOverride('/proj');
      expect(value).toBe('/project');
    });

    it('resolveClaudeConfigDirOverride falls back to global when project has none', async () => {
      mockGlobalAndProjectEnv({ CLAUDE_CONFIG_DIR: '/global' }, {});

      const value = await resolveClaudeConfigDirOverride('/proj');
      expect(value).toBe('/global');
    });

    it('resolveClaudeConfigDirOverride returns null when no override is set', async () => {
      mockReadFile.mockImplementation((async () => `export default {};`) as unknown as typeof readFile);

      const value = await resolveClaudeConfigDirOverride();
      expect(value).toBeNull();
    });
  });

  describe('saveEnvVarToScope', () => {
    beforeEach(() => {
      mockMkdir.mockResolvedValue(undefined);
    });

    it('writes an env var into global settings', async () => {
      mockExistsSync.mockReturnValue(false);
      let written = '';
      mockWriteFile.mockImplementation((async (_p: string, content: string) => {
        written = String(content);
      }) as unknown as typeof writeFile);

      const result = await saveEnvVarToScope('CLAUDE_CONFIG_DIR', '/home/u/.claude-work', 'global');

      expect(result.status).toBe('ok');
      expect(written).toContain('CLAUDE_CONFIG_DIR');
      expect(written).toContain('/home/u/.claude-work');
    });

    it('removes an env var when value is null', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(
        `export default { env: { CLAUDE_CONFIG_DIR: "/home/u/.claude-work" } };`,
      );
      let written = '';
      mockWriteFile.mockImplementation((async (_p: string, content: string) => {
        written = String(content);
      }) as unknown as typeof writeFile);

      const result = await saveEnvVarToScope('CLAUDE_CONFIG_DIR', null, 'global');

      expect(result.status).toBe('ok');
      expect(written).not.toContain('.claude-work');
    });
  });
});
