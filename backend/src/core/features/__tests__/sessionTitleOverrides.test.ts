import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  readSessionTitleOverrides,
  writeSessionTitleOverride,
  removeSessionTitleOverride,
} from '../sessionTitleOverrides';

const OVERRIDES_FILE = '.claude-code-gui-session-titles.json';

describe('sessionTitleOverrides', () => {
  let sessionsPath: string;

  beforeEach(async () => {
    sessionsPath = await mkdtemp(join(tmpdir(), 'session-titles-'));
  });

  afterEach(async () => {
    await rm(sessionsPath, { recursive: true, force: true });
  });

  describe('readSessionTitleOverrides', () => {
    it('returns an empty object when the overrides file does not exist', async () => {
      expect(await readSessionTitleOverrides(sessionsPath)).toEqual({});
    });

    it('returns an empty object when the file contains invalid JSON', async () => {
      await writeFile(join(sessionsPath, OVERRIDES_FILE), 'not json', 'utf-8');
      expect(await readSessionTitleOverrides(sessionsPath)).toEqual({});
    });

    it('returns an empty object when the JSON is an array', async () => {
      await writeFile(join(sessionsPath, OVERRIDES_FILE), '["a","b"]', 'utf-8');
      expect(await readSessionTitleOverrides(sessionsPath)).toEqual({});
    });

    it('filters out non-string and blank values', async () => {
      await writeFile(
        join(sessionsPath, OVERRIDES_FILE),
        JSON.stringify({ a: 'Title A', b: 42, c: '   ', d: 'Title D' }),
        'utf-8',
      );
      expect(await readSessionTitleOverrides(sessionsPath)).toEqual({ a: 'Title A', d: 'Title D' });
    });
  });

  describe('writeSessionTitleOverride', () => {
    it('persists a title and reads it back', async () => {
      await writeSessionTitleOverride(sessionsPath, 'session-1', 'My Title');
      expect(await readSessionTitleOverrides(sessionsPath)).toEqual({ 'session-1': 'My Title' });
    });

    it('merges with existing overrides without dropping others', async () => {
      await writeSessionTitleOverride(sessionsPath, 'session-1', 'First');
      await writeSessionTitleOverride(sessionsPath, 'session-2', 'Second');
      expect(await readSessionTitleOverrides(sessionsPath)).toEqual({
        'session-1': 'First',
        'session-2': 'Second',
      });
    });

    it('overwrites the title for an existing session', async () => {
      await writeSessionTitleOverride(sessionsPath, 'session-1', 'Old');
      await writeSessionTitleOverride(sessionsPath, 'session-1', 'New');
      expect(await readSessionTitleOverrides(sessionsPath)).toEqual({ 'session-1': 'New' });
    });

    it('creates the sessions directory if it is missing', async () => {
      const nested = join(sessionsPath, 'does', 'not', 'exist');
      await writeSessionTitleOverride(nested, 'session-1', 'Nested');
      expect(await readSessionTitleOverrides(nested)).toEqual({ 'session-1': 'Nested' });
    });
  });

  describe('removeSessionTitleOverride', () => {
    it('removes an existing override', async () => {
      await writeSessionTitleOverride(sessionsPath, 'session-1', 'First');
      await writeSessionTitleOverride(sessionsPath, 'session-2', 'Second');
      await removeSessionTitleOverride(sessionsPath, 'session-1');
      expect(await readSessionTitleOverrides(sessionsPath)).toEqual({ 'session-2': 'Second' });
    });

    it('is a no-op when the session has no override', async () => {
      await writeSessionTitleOverride(sessionsPath, 'session-1', 'First');
      await removeSessionTitleOverride(sessionsPath, 'unknown');
      expect(await readSessionTitleOverrides(sessionsPath)).toEqual({ 'session-1': 'First' });
    });

    it('does not throw when the overrides file is missing', async () => {
      await expect(removeSessionTitleOverride(sessionsPath, 'whatever')).resolves.toBeUndefined();
    });
  });
});
