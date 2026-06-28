import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { cleanupExtractedTempDirs } from '../temp-cleanup';

/**
 * Creates a throwaway directory under the OS temp dir with a marker file inside,
 * mimicking the `claude-code-webview-*` / `claude-code-backend-*` dirs that Kotlin
 * extracts from the plugin JAR. Returns the directory path.
 */
function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  writeFileSync(join(dir, 'marker.txt'), 'x');
  return dir;
}

describe('cleanupExtractedTempDirs', () => {
  const created: string[] = [];

  afterEach(() => {
    // Best-effort safety net for anything a test left behind.
    for (const dir of created.splice(0)) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // already gone
      }
    }
  });

  it('removes a directory that exists', () => {
    const dir = makeTempDir('cc-cleanup-a-');
    created.push(dir);
    expect(existsSync(dir)).toBe(true);

    cleanupExtractedTempDirs([dir]);

    expect(existsSync(dir)).toBe(false);
  });

  it('removes a directory recursively, including nested files', () => {
    const dir = makeTempDir('cc-cleanup-nested-');
    created.push(dir);
    const sub = join(dir, 'assets');
    mkdirSync(sub);
    writeFileSync(join(sub, 'bundle.js'), 'console.log(1)');

    cleanupExtractedTempDirs([dir]);

    expect(existsSync(dir)).toBe(false);
  });

  it('does not throw for a non-existent path', () => {
    const ghost = join(tmpdir(), 'cc-cleanup-does-not-exist-12345');
    expect(existsSync(ghost)).toBe(false);
    expect(() => cleanupExtractedTempDirs([ghost])).not.toThrow();
  });

  it('does not throw for an empty array', () => {
    expect(() => cleanupExtractedTempDirs([])).not.toThrow();
  });

  it('skips empty / undefined entries without throwing', () => {
    const dir = makeTempDir('cc-cleanup-mixed-');
    created.push(dir);

    // Intentionally pass undefined/empty to prove they are skipped.
    cleanupExtractedTempDirs([undefined, '', dir]);

    expect(existsSync(dir)).toBe(false);
  });

  it('continues to other dirs when one removal fails', () => {
    const good = makeTempDir('cc-cleanup-good-');
    created.push(good);

    // A path whose *parent* is a regular file — rmSync of a child under it throws
    // ENOTDIR, exercising the per-entry try/catch without aborting the whole run.
    const fileAsParent = join(tmpdir(), 'cc-cleanup-file-' + Date.now());
    writeFileSync(fileAsParent, 'not a dir');
    created.push(fileAsParent);
    const bad = join(fileAsParent, 'child');

    expect(() => cleanupExtractedTempDirs([bad, good])).not.toThrow();

    // The good dir must still have been removed despite the bad entry.
    expect(existsSync(good)).toBe(false);
  });
});
