import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  watch: vi.fn(),
}));

vi.mock('os', () => ({
  homedir: vi.fn(() => '/mock-home'),
}));

import { readFile } from 'fs/promises';
import { getEnvApiKeys } from '../claude-settings';

const mockReadFile = vi.mocked(readFile);

describe('getEnvApiKeys()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return ANTHROPIC_API_KEY and CLAUDE_API_KEY from env', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        env: {
          ANTHROPIC_API_KEY: 'sk-ant-xxx',
          PATH: '/usr/bin',
          CLAUDE_API_KEY: 'ck-xxx',
        },
      }) as never,
    );
    const keys = await getEnvApiKeys();
    expect(keys).toContain('ANTHROPIC_API_KEY');
    expect(keys).toContain('CLAUDE_API_KEY');
    expect(keys).not.toContain('PATH');
  });

  it('should return empty array when settings has no env key', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({}) as never);
    const keys = await getEnvApiKeys();
    expect(keys).toEqual([]);
  });

  it('should return empty array when env has no API keys', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        env: { PATH: '/usr/bin', HOME: '/home/user' },
      }) as never,
    );
    const keys = await getEnvApiKeys();
    expect(keys).toEqual([]);
  });

  it('should match custom API_KEY suffix pattern like MY_SERVICE_API_KEY', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        env: { MY_SERVICE_API_KEY: 'xxx' },
      }) as never,
    );
    const keys = await getEnvApiKeys();
    expect(keys).toContain('MY_SERVICE_API_KEY');
  });

  it('should match API_TOKEN suffix pattern like SOME_API_TOKEN', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        env: { SOME_API_TOKEN: 'yyy' },
      }) as never,
    );
    const keys = await getEnvApiKeys();
    expect(keys).toContain('SOME_API_TOKEN');
  });

  it('should match AUTH_TOKEN suffix pattern', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        env: { MY_AUTH_TOKEN: 'zzz' },
      }) as never,
    );
    const keys = await getEnvApiKeys();
    expect(keys).toContain('MY_AUTH_TOKEN');
  });

  it('should match ANTHROPIC_AUTH_TOKEN exactly', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        env: { ANTHROPIC_AUTH_TOKEN: 'tok' },
      }) as never,
    );
    const keys = await getEnvApiKeys();
    expect(keys).toContain('ANTHROPIC_AUTH_TOKEN');
  });

  it('should return empty array when env is not an object', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        env: 'not-an-object',
      }) as never,
    );
    const keys = await getEnvApiKeys();
    expect(keys).toEqual([]);
  });

  it('should return empty array when readFile throws', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const keys = await getEnvApiKeys();
    expect(keys).toEqual([]);
  });
});
