import { describe, it, expect } from 'vitest';
import {
  normalizePathForMatch,
  pathIsUnder,
  extractRoutingPath,
  selectRpcClientIndex,
} from '../rpc-routing';

describe('normalizePathForMatch', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizePathForMatch('C:\\Users\\me\\proj')).toBe(
      normalizePathForMatch('C:/Users/me/proj'),
    );
  });

  it('strips trailing slashes', () => {
    expect(normalizePathForMatch('/a/b/')).toBe(normalizePathForMatch('/a/b'));
  });
});

describe('pathIsUnder', () => {
  it('matches an exact path', () => {
    expect(pathIsUnder('/a/b/c', '/a/b/c')).toBe(true);
  });

  it('matches a child path', () => {
    expect(pathIsUnder('/a/b/c/file.ts', '/a/b/c')).toBe(true);
  });

  it('is segment-boundary safe (/foo does not match /foobar)', () => {
    expect(pathIsUnder('/foobar/x', '/foo')).toBe(false);
  });

  it('does not match an unrelated path', () => {
    expect(pathIsUnder('/x/y', '/a/b')).toBe(false);
  });

  it('treats an empty base as no match', () => {
    expect(pathIsUnder('/a/b', '')).toBe(false);
  });
});

describe('extractRoutingPath', () => {
  it('prefers filePath', () => {
    expect(extractRoutingPath({ filePath: '/a/b.ts', workingDir: '/c' })).toBe('/a/b.ts');
  });

  it('falls back to path', () => {
    expect(extractRoutingPath({ path: '/a/b.ts' })).toBe('/a/b.ts');
  });

  it('falls back to workingDir', () => {
    expect(extractRoutingPath({ workingDir: '/proj' })).toBe('/proj');
  });

  it('uses first entry of paths[]', () => {
    expect(extractRoutingPath({ paths: ['/a/x.ts', '/a/y.ts'] })).toBe('/a/x.ts');
  });

  it('returns undefined when no routable key is present', () => {
    expect(extractRoutingPath({ url: 'https://x', toolUseId: 't1' })).toBeUndefined();
  });

  it('ignores empty string values', () => {
    expect(extractRoutingPath({ workingDir: '' })).toBeUndefined();
  });
});

describe('selectRpcClientIndex', () => {
  const open = (roots: string[]) => ({ roots, isOpen: true });

  it('returns -1 when there are no clients', () => {
    expect(selectRpcClientIndex([], '/a/b')).toBe(-1);
  });

  it('returns -1 when every client is closed', () => {
    expect(selectRpcClientIndex([{ roots: ['/a'], isOpen: false }], '/a/b')).toBe(-1);
  });

  it('falls back to the first open client when no routingPath is given', () => {
    const entries = [open(['/a']), open(['/b'])];
    expect(selectRpcClientIndex(entries, undefined)).toBe(0);
  });

  it('routes to the client owning the path', () => {
    const entries = [open(['/projA']), open(['/projB'])];
    expect(selectRpcClientIndex(entries, '/projB/src/file.ts')).toBe(1);
  });

  it('skips closed clients even when they own the path', () => {
    const entries = [
      { roots: ['/projA'], isOpen: true },
      { roots: ['/projB'], isOpen: false },
    ];
    // /projB owner is closed → fall back to first open client
    expect(selectRpcClientIndex(entries, '/projB/x.ts')).toBe(0);
  });

  it('prefers the longest matching root (nested projects)', () => {
    const entries = [open(['/work']), open(['/work/nested'])];
    expect(selectRpcClientIndex(entries, '/work/nested/file.ts')).toBe(1);
  });

  it('falls back to the first open client when the path matches no root', () => {
    const entries = [open(['/projA']), open(['/projB'])];
    expect(selectRpcClientIndex(entries, '/elsewhere/file.ts')).toBe(0);
  });

  it('handles a client that serves multiple roots', () => {
    const entries = [open(['/x', '/projB']), open(['/projA'])];
    expect(selectRpcClientIndex(entries, '/projB/file.ts')).toBe(0);
  });
});
