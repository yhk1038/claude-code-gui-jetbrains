import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('../getProjectSessionsPath', () => ({
  getProjectSessionsPath: vi.fn(),
}));

import { readFile, stat } from 'fs/promises';
import { loadSessionMessages } from '../loadSessionMessages';
import { getProjectSessionsPath } from '../getProjectSessionsPath';

const mockReadFile = vi.mocked(readFile);
const mockStat = vi.mocked(stat);
const mockGetPath = vi.mocked(getProjectSessionsPath);

describe('loadSessionMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPath.mockResolvedValue('/sessions');
    // Default: no subagents directory
    mockStat.mockRejectedValue(new Error('ENOENT'));
  });

  it('should load and parse JSONL messages', async () => {
    const jsonl = [
      JSON.stringify({ type: 'user', uuid: 'u1', message: { content: 'Hello' } }),
      JSON.stringify({ type: 'assistant', uuid: 'u2', message: { content: 'Hi' } }),
    ].join('\n');

    mockReadFile.mockResolvedValue(jsonl);

    const result = await loadSessionMessages('/work', 'sess-1');
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('user');
    expect(result[1].type).toBe('assistant');
  });

  it('should skip invalid JSON lines', async () => {
    const jsonl = [
      'invalid json',
      JSON.stringify({ type: 'user', uuid: 'u1' }),
      '{broken',
    ].join('\n');

    mockReadFile.mockResolvedValue(jsonl);

    const result = await loadSessionMessages('/work', 'sess-1');
    expect(result).toHaveLength(1);
  });

  it('should return empty array on file read error', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    const result = await loadSessionMessages('/work', 'nonexistent');
    expect(result).toEqual([]);
  });

  it('should pass through all JSONL entry types without filtering', async () => {
    const jsonl = [
      JSON.stringify({ type: 'user', uuid: 'u1' }),
      JSON.stringify({ type: 'assistant', uuid: 'u2' }),
      JSON.stringify({ type: 'summary', leafUuid: 'u2', summary: 'test' }),
      JSON.stringify({ type: 'system', uuid: 'u3' }),
      JSON.stringify({ type: 'progress', uuid: 'u4' }),
    ].join('\n');

    mockReadFile.mockResolvedValue(jsonl);

    const result = await loadSessionMessages('/work', 'sess-1');
    expect(result).toHaveLength(5);
  });

  it('should skip empty lines', async () => {
    const jsonl = '\n' + JSON.stringify({ type: 'user', uuid: 'u1' }) + '\n\n';
    mockReadFile.mockResolvedValue(jsonl);

    const result = await loadSessionMessages('/work', 'sess-1');
    expect(result).toHaveLength(1);
  });
});
