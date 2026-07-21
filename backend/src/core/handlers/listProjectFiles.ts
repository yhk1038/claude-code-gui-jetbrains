import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { MessageType } from '../../shared';
import { resolveWslCwd } from '../wsl-path';

const execFileAsync = promisify(execFile);

interface FileEntry {
  relativePath: string;
  type: 'file' | 'directory';
}

interface CacheEntry {
  files: string[];
  dirs: string[];
  timestamp: number;
}

const fileCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function isGitRepo(workingDir: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: workingDir });
    return true;
  } catch {
    return false;
  }
}

const EXCLUDED_DIRS = new Set(['node_modules', '.git']);
const MAX_DEPTH = 5;

/**
 * Cross-platform recursive directory walk using Node.js fs.
 * Collects files and directories up to MAX_DEPTH levels deep, excluding
 * EXCLUDED_DIRS at any level. Returns paths relative to `root` using
 * forward slashes on all platforms.
 */
async function walkDir(
  root: string,
  currentDir: string,
  depth: number,
  files: string[],
  dirs: string[],
): Promise<void> {
  if (depth > MAX_DEPTH) {
    return;
  }

  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      // Skip symlinks entirely to avoid infinite loops
      continue;
    }

    const absPath = path.join(currentDir, entry.name);
    // Compute relative path from root and normalise to forward slashes
    const relPath = path.relative(root, absPath).split(path.sep).join('/');

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      dirs.push(relPath);
      await walkDir(root, absPath, depth + 1, files, dirs);
    } else if (entry.isFile()) {
      files.push(relPath);
    }
  }
}

export async function fetchFilesAndDirs(workingDir: string): Promise<{ files: string[]; dirs: string[] }> {
  const cached = fileCache.get(workingDir);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { files: cached.files, dirs: cached.dirs };
  }

  let files: string[] = [];
  let dirs: string[] = [];

  try {
    if (await isGitRepo(workingDir)) {
      const { stdout } = await execFileAsync(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard'],
        { cwd: workingDir, maxBuffer: 10 * 1024 * 1024 },
      );
      files = stdout.split('\n').filter((f) => f.length > 0);

      // Extract unique directories from file paths
      const dirSet = new Set<string>();
      for (const file of files) {
        const parts = file.split('/');
        for (let i = 1; i < parts.length; i++) {
          dirSet.add(parts.slice(0, i).join('/'));
        }
      }
      dirs = Array.from(dirSet);
    } else {
      // Cross-platform: use Node.js fs instead of Unix `find` (Windows compatible)
      await walkDir(workingDir, workingDir, 1, files, dirs);
    }
  } catch {
    // On error, return empty — do not break the service
    files = [];
    dirs = [];
  }

  fileCache.set(workingDir, { files, dirs, timestamp: Date.now() });
  return { files, dirs };
}

function matchesQuery(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.toLowerCase());
}

export async function listProjectFilesHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const query = (message.payload?.query as string) ?? '';
  const rawWorkingDir = (message.payload?.workingDir as string) ?? process.cwd();
  // In JetBrains mode a WSL project's backend runs inside the distro
  // (process.platform === 'linux'), but the IDE hands the project root over the
  // wire as a Windows UNC path (`//wsl.localhost/<distro>/...`) that doesn't exist
  // inside the distro. Left as-is, git/fs.readdir hit ENOENT and the `@` mention
  // dropdown silently shows an empty list. Convert it to the inner Linux path —
  // the same resolveWslCwd fix claude.ts/command.ts already apply. A no-op
  // off-linux or for non-UNC paths. Issue #195.
  const workingDir = (resolveWslCwd(rawWorkingDir) as string) ?? rawWorkingDir;
  const limit = (message.payload?.limit as number) ?? 20;

  try {
    const { files, dirs } = await fetchFilesAndDirs(workingDir);

    let result: FileEntry[];

    if (query.trim() === '') {
      // No query: return directories only (cap at limit)
      result = dirs.slice(0, limit).map((d) => ({ relativePath: d, type: 'directory' as const }));
    } else {
      // Query present: match files and dirs by basename
      const matchedFiles: FileEntry[] = files
        .filter((f) => {
          const basename = f.split('/').pop() ?? f;
          return matchesQuery(basename, query) || matchesQuery(f, query);
        })
        .map((f) => ({ relativePath: f, type: 'file' as const }));

      const matchedDirs: FileEntry[] = dirs
        .filter((d) => {
          const basename = d.split('/').pop() ?? d;
          return matchesQuery(basename, query) || matchesQuery(d, query);
        })
        .map((d) => ({ relativePath: d, type: 'directory' as const }));

      // Dirs first, then files, capped at limit
      result = [...matchedDirs, ...matchedFiles].slice(0, limit);
    }

    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      files: result,
    });
  } catch {
    connections.sendTo(connectionId, MessageType.ACK, {
      requestId: message.requestId,
      files: [],
    });
  }
}
