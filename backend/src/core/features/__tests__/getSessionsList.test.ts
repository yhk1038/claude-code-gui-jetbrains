import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('../getProjectSessionsPath', () => ({
  getProjectSessionsPath: vi.fn(),
}));

vi.mock('../extractSessionInfo', () => ({
  extractSessionInfo: vi.fn(),
}));

import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { getSessionsList } from '../getSessionsList';
import { getProjectSessionsPath } from '../getProjectSessionsPath';
import { extractSessionInfo } from '../extractSessionInfo';

const mockReaddir = vi.mocked(readdir);
const mockExistsSync = vi.mocked(existsSync);
const mockGetPath = vi.mocked(getProjectSessionsPath);
const mockExtractInfo = vi.mocked(extractSessionInfo);

describe('getSessionsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPath.mockResolvedValue('/home/.claude/projects/-test');
  });

  it('should return empty array when sessions dir does not exist', async () => {
    mockExistsSync.mockReturnValue(false);
    const result = await getSessionsList('/test');
    expect(result).toEqual([]);
  });

  it('should return sessions sorted by lastTimestamp descending', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddir.mockResolvedValue(['sess-1.jsonl', 'sess-2.jsonl'] as unknown as Awaited<ReturnType<typeof readdir>>);
    mockExtractInfo
      .mockResolvedValueOnce({
        title: 'Old session',
        lastTimestamp: '2025-01-01T00:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        messageCount: 5,
        isSidechain: false,
      })
      .mockResolvedValueOnce({
        title: 'New session',
        lastTimestamp: '2025-01-02T00:00:00Z',
        createdAt: '2025-01-02T00:00:00Z',
        messageCount: 3,
        isSidechain: false,
      });

    const result = await getSessionsList('/test');

    expect(result).toHaveLength(2);
    expect(result[0].sessionId).toBe('sess-2');
    expect(result[1].sessionId).toBe('sess-1');
  });

  it('should filter only .jsonl files', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddir.mockResolvedValue(['sess-1.jsonl', 'readme.txt', 'data.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
    mockExtractInfo.mockResolvedValue({
      title: 'Session',
      lastTimestamp: '2025-01-01T00:00:00Z',
      createdAt: '2025-01-01T00:00:00Z',
      messageCount: 1,
      isSidechain: false,
    });

    const result = await getSessionsList('/test');

    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe('sess-1');
  });

  it('should skip sessions that fail to parse', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddir.mockResolvedValue(['good.jsonl', 'bad.jsonl'] as unknown as Awaited<ReturnType<typeof readdir>>);
    mockExtractInfo
      .mockResolvedValueOnce({
        title: 'Good',
        lastTimestamp: '2025-01-01T00:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        messageCount: 1,
        isSidechain: false,
      })
      .mockRejectedValueOnce(new Error('Parse failed'));

    const result = await getSessionsList('/test');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Good');
  });
});
