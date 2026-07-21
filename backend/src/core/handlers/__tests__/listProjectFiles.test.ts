import { describe, it, expect, afterEach, vi } from 'vitest';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { fetchFilesAndDirs, listProjectFilesHandler } from '../listProjectFiles';
import type { ConnectionManager } from '../../../ws/connection-manager';
import type { Bridge } from '../../../bridge/bridge-interface';
import type { IPCMessage } from '../../types';
import { MessageType } from '../../../shared';

// Helper: create a directory tree under a temp root
// Structure:
//   <root>/
//     file-root.txt
//     subdir/
//       file-sub.ts
//       deeper/
//         file-deep.js
//           level3/
//             file-l3.txt
//               level4/
//                 file-l4.txt
//                   level5/
//                     file-l5.txt
//                       level6/          ← depth 6 from root, must be excluded
//                         file-l6.txt
//     node_modules/                      ← must be excluded entirely
//       some-pkg/
//         index.js
//     .git/                              ← must be excluded entirely
//       HEAD
//     empty-dir/

function buildFileTree(root: string): void {
  const mk = (rel: string) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, '');
  };
  const mkdir = (rel: string) => fs.mkdirSync(path.join(root, rel), { recursive: true });

  mk('file-root.txt');
  mk('subdir/file-sub.ts');
  mk('subdir/deeper/file-deep.js');
  mk('subdir/deeper/level3/file-l3.txt');
  mk('subdir/deeper/level3/level4/file-l4.txt');
  mk('subdir/deeper/level3/level4/level5/file-l5.txt');
  // depth-6 file — should NOT appear
  mk('subdir/deeper/level3/level4/level5/level6/file-l6.txt');

  // excluded directories
  mk('node_modules/some-pkg/index.js');
  mk('.git/HEAD');

  // empty dir
  mkdir('empty-dir');
}

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'listProjectFiles-test-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of tmpDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  tmpDirs = [];
});

describe('fetchFilesAndDirs (non-git directory)', () => {
  it('collects files and dirs up to maxdepth 5 (matching Unix find -maxdepth 5 semantics)', async () => {
    const root = makeTmpDir();
    buildFileTree(root);

    const { files, dirs } = await fetchFilesAndDirs(root);

    // find -maxdepth 5 counts depth from the root itself (root = depth 0):
    //   depth 1: file-root.txt, subdir/
    //   depth 2: subdir/file-sub.ts, subdir/deeper/
    //   depth 3: subdir/deeper/file-deep.js, subdir/deeper/level3/
    //   depth 4: subdir/deeper/level3/file-l3.txt, subdir/deeper/level3/level4/
    //   depth 5: subdir/deeper/level3/level4/file-l4.txt  ← last included
    //   depth 6: subdir/deeper/level3/level4/level5/...   ← excluded

    expect(files).toContain('file-root.txt');                             // depth 1
    expect(files).toContain('subdir/file-sub.ts');                        // depth 2
    expect(files).toContain('subdir/deeper/file-deep.js');                // depth 3
    expect(files).toContain('subdir/deeper/level3/file-l3.txt');          // depth 4
    expect(files).toContain('subdir/deeper/level3/level4/file-l4.txt');   // depth 5 — included

    // depth 6 and beyond must NOT appear
    expect(files).not.toContain('subdir/deeper/level3/level4/level5/file-l5.txt');
    expect(files).not.toContain('subdir/deeper/level3/level4/level5/level6/file-l6.txt');
  });

  it('excludes node_modules directory and its contents', async () => {
    const root = makeTmpDir();
    buildFileTree(root);

    const { files, dirs } = await fetchFilesAndDirs(root);

    // No files inside node_modules
    const nmFiles = files.filter((f) => f.startsWith('node_modules'));
    expect(nmFiles).toHaveLength(0);

    // node_modules itself should not appear in dirs
    const nmDirs = dirs.filter((d) => d === 'node_modules' || d.startsWith('node_modules/'));
    expect(nmDirs).toHaveLength(0);
  });

  it('excludes .git directory and its contents', async () => {
    const root = makeTmpDir();
    buildFileTree(root);

    const { files, dirs } = await fetchFilesAndDirs(root);

    const gitFiles = files.filter((f) => f.startsWith('.git'));
    expect(gitFiles).toHaveLength(0);

    const gitDirs = dirs.filter((d) => d === '.git' || d.startsWith('.git/'));
    expect(gitDirs).toHaveLength(0);
  });

  it('returns relative paths with forward slashes (cross-platform)', async () => {
    const root = makeTmpDir();
    buildFileTree(root);

    const { files, dirs } = await fetchFilesAndDirs(root);

    for (const f of files) {
      expect(f).not.toMatch(/\\/); // no backslashes
    }
    for (const d of dirs) {
      expect(d).not.toMatch(/\\/);
    }
  });

  it('paths do not start with ./ prefix', async () => {
    const root = makeTmpDir();
    buildFileTree(root);

    const { files, dirs } = await fetchFilesAndDirs(root);

    for (const f of files) {
      expect(f).not.toMatch(/^\.\//);
    }
    for (const d of dirs) {
      expect(d).not.toMatch(/^\.\//);
    }
  });

  it('directories list contains traversed subdirs', async () => {
    const root = makeTmpDir();
    buildFileTree(root);

    const { dirs } = await fetchFilesAndDirs(root);

    expect(dirs).toContain('subdir');
    expect(dirs).toContain('subdir/deeper');
    expect(dirs).toContain('empty-dir');
  });

  it('returns empty lists when directory is empty', async () => {
    const root = makeTmpDir();

    const { files, dirs } = await fetchFilesAndDirs(root);

    expect(files).toHaveLength(0);
    expect(dirs).toHaveLength(0);
  });

  it('does not throw when the working directory does not exist — falls back to empty', async () => {
    const nonExistent = path.join(os.tmpdir(), 'this-path-does-not-exist-listpf-test');

    const { files, dirs } = await fetchFilesAndDirs(nonExistent);

    expect(files).toHaveLength(0);
    expect(dirs).toHaveLength(0);
  });
});

// A WSL project opened in JetBrains runs the backend inside the distro
// (process.platform === 'linux'), yet the IDE hands the project root over the
// wire as a Windows UNC path (`//wsl.localhost/<distro>/...`) that does not exist
// inside the distro. The handler must translate it to the inner Linux path (the
// same resolveWslCwd conversion claude.ts/command.ts already apply) or the `@`
// mention dropdown silently returns an empty list. Issue #195.
//
// These tests build a real temp tree and address it through a synthetic UNC path,
// so they only make sense on a POSIX filesystem — skip on win32.
const describeWsl = process.platform === 'win32' ? describe.skip : describe;

describeWsl('listProjectFilesHandler (WSL UNC workingDir)', () => {
  const originalPlatform = process.platform;

  function setPlatform(platform: NodeJS.Platform): void {
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  }

  function mockConns(): ConnectionManager {
    return { sendTo: vi.fn() } as unknown as ConnectionManager;
  }

  function lastSend(conns: ConnectionManager): [string, string, Record<string, unknown>] {
    const calls = (conns.sendTo as ReturnType<typeof vi.fn>).mock.calls;
    return calls[calls.length - 1] as [string, string, Record<string, unknown>];
  }

  function msg(workingDir: string, query: string): IPCMessage {
    return {
      type: MessageType.LIST_PROJECT_FILES,
      payload: { workingDir, query, limit: 20 },
      timestamp: 0,
      requestId: 'req-1',
    };
  }

  // Wrap an absolute Linux temp path as the UNC path the IDE would hand over:
  //   /var/folders/x/proj  ->  //wsl.localhost/Ubuntu/var/folders/x/proj
  function toUnc(linuxAbsPath: string): string {
    return `//wsl.localhost/Ubuntu${linuxAbsPath}`;
  }

  afterEach(() => setPlatform(originalPlatform));

  it('on linux, resolves a WSL UNC workingDir to the inner Linux path before listing', async () => {
    setPlatform('linux');
    const root = makeTmpDir();
    fs.writeFileSync(path.join(root, 'hello-mention.ts'), '');

    const conns = mockConns();
    await listProjectFilesHandler('c1', msg(toUnc(root), 'hello-mention'), conns, {} as Bridge);

    const [connId, type, payload] = lastSend(conns);
    expect(connId).toBe('c1');
    expect(type).toBe(MessageType.ACK);
    expect(payload.requestId).toBe('req-1');
    const files = payload.files as Array<{ relativePath: string; type: string }>;
    expect(files.map((f) => f.relativePath)).toContain('hello-mention.ts');
  });

  it('on linux, a plain Linux workingDir is listed unchanged', async () => {
    setPlatform('linux');
    const root = makeTmpDir();
    fs.writeFileSync(path.join(root, 'plain-file.ts'), '');

    const conns = mockConns();
    await listProjectFilesHandler('c1', msg(root, 'plain-file'), conns, {} as Bridge);

    const [, type, payload] = lastSend(conns);
    expect(type).toBe(MessageType.ACK);
    const files = payload.files as Array<{ relativePath: string; type: string }>;
    expect(files.map((f) => f.relativePath)).toContain('plain-file.ts');
  });
});
