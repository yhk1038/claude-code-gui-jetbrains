import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { readJsonlEntries } from '../readJsonlEntries';

describe('readJsonlEntries', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'read-jsonl-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function writeJsonl(content: string): Promise<string> {
    const filePath = join(tmpDir, `entries-${Math.random().toString(36).slice(2)}.jsonl`);
    await writeFile(filePath, content);
    return filePath;
  }

  it('parses each line into an object preserving order', async () => {
    const filePath = await writeJsonl(
      [
        JSON.stringify({ uuid: 'a', type: 'user' }),
        JSON.stringify({ uuid: 'b', type: 'assistant' }),
        JSON.stringify({ uuid: 'c', type: 'user' }),
      ].join('\n'),
    );

    const entries = await readJsonlEntries(filePath);

    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ uuid: 'a', type: 'user' });
    expect(entries[2]).toEqual({ uuid: 'c', type: 'user' });
  });

  it('skips blank and malformed lines without throwing', async () => {
    const filePath = await writeJsonl(
      [
        '',
        '   ',
        'not valid json',
        JSON.stringify({ uuid: 'a' }),
        '{"broken',
        JSON.stringify({ uuid: 'b' }),
        '',
      ].join('\n'),
    );

    const entries = await readJsonlEntries(filePath);

    expect(entries).toEqual([{ uuid: 'a' }, { uuid: 'b' }]);
  });

  it('returns [] for an empty file', async () => {
    const filePath = await writeJsonl('');

    const entries = await readJsonlEntries(filePath);

    expect(entries).toEqual([]);
  });

  it('rejects when the file does not exist', async () => {
    await expect(readJsonlEntries(join(tmpDir, 'nope.jsonl'))).rejects.toThrow();
  });

  // Regression coverage for issue #19: clicking a large session should not
  // require building a giant intermediate string + split array.
  it('handles a multi-megabyte JSONL file', async () => {
    const lines: string[] = [];
    const filler = 'A'.repeat(1000);
    for (let i = 0; i < 10_000; i++) {
      lines.push(JSON.stringify({ uuid: `u${i}`, type: 'assistant', text: filler }));
    }
    const filePath = await writeJsonl(lines.join('\n'));

    const entries = await readJsonlEntries(filePath);

    expect(entries).toHaveLength(10_000);
    expect(entries[0]).toMatchObject({ uuid: 'u0' });
    expect(entries[9_999]).toMatchObject({ uuid: 'u9999' });
  }, 15_000);
});
