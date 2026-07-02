import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

vi.mock('../getProjectSessionsPath', () => ({
  getProjectSessionsPath: vi.fn(),
}));

import { loadSessionMessages } from '../loadSessionMessages';
import { getProjectSessionsPath } from '../getProjectSessionsPath';

const mockGetPath = vi.mocked(getProjectSessionsPath);

describe('loadSessionMessages', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await mkdtemp(join(tmpdir(), 'load-session-'));
    mockGetPath.mockResolvedValue(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function writeSession(sessionId: string, lines: string[]): Promise<void> {
    await writeFile(join(tmpDir, `${sessionId}.jsonl`), lines.join('\n'));
  }

  it('should load and parse JSONL messages', async () => {
    await writeSession('sess-1', [
      JSON.stringify({ type: 'user', uuid: 'u1', message: { content: 'Hello' } }),
      JSON.stringify({ type: 'assistant', uuid: 'u2', message: { content: 'Hi' } }),
    ]);

    const result = await loadSessionMessages('/work', 'sess-1');
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].type).toBe('user');
    expect(result.messages[1].type).toBe('assistant');
  });

  it('should skip invalid JSON lines', async () => {
    await writeSession('sess-1', [
      'invalid json',
      JSON.stringify({ type: 'user', uuid: 'u1' }),
      '{broken',
    ]);

    const result = await loadSessionMessages('/work', 'sess-1');
    expect(result.messages).toHaveLength(1);
  });

  it('should return empty array on file read error', async () => {
    const result = await loadSessionMessages('/work', 'nonexistent');
    expect(result.messages).toEqual([]);
  });

  it('should pass through all JSONL entry types without filtering', async () => {
    await writeSession('sess-1', [
      JSON.stringify({ type: 'user', uuid: 'u1' }),
      JSON.stringify({ type: 'assistant', uuid: 'u2' }),
      JSON.stringify({ type: 'summary', leafUuid: 'u2', summary: 'test' }),
      JSON.stringify({ type: 'system', uuid: 'u3' }),
      JSON.stringify({ type: 'progress', uuid: 'u4' }),
    ]);

    const result = await loadSessionMessages('/work', 'sess-1');
    expect(result.messages).toHaveLength(5);
  });

  it('should skip empty lines', async () => {
    await writeSession('sess-1', ['', JSON.stringify({ type: 'user', uuid: 'u1' }), '', '']);
    const result = await loadSessionMessages('/work', 'sess-1');
    expect(result.messages).toHaveLength(1);
  });

  // Regression test for issue #19: large session files must stream, not block.
  it('should handle multi-megabyte session files without exhausting memory', async () => {
    const lines: string[] = [];
    const bulk = 'A'.repeat(1000);
    for (let i = 0; i < 10_000; i++) {
      lines.push(
        JSON.stringify({
          type: i % 2 === 0 ? 'user' : 'assistant',
          uuid: `u${i}`,
          message: { content: [{ type: 'text', text: bulk }] },
        }),
      );
    }
    await writeSession('sess-big', lines);

    const result = await loadSessionMessages('/work', 'sess-big', undefined, 15_000);
    expect(result.messages).toHaveLength(10_000);
    expect(result.messages[0].type).toBe('user');
    expect(result.messages[9_999].type).toBe('assistant');
  }, 15_000);
});
