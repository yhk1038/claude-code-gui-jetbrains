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
import { readSettingsFile, saveSettingToFile } from '../settings';

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
  });

  describe('readSettingsFile()', () => {
    it('should return defaults and create file when settings file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await readSettingsFile();

      expect(result).toEqual({
        cliPath: null,
        theme: 'system',
        fontSize: 13,
        autoScrollThreshold: 80,
        debugMode: false,
        logLevel: 'info',
        terminalApp: null,
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
        theme: 'system',
        fontSize: 13,
        autoScrollThreshold: 80,
        debugMode: false,
        logLevel: 'info',
        terminalApp: null,
      });
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
});
