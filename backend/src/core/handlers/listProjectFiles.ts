import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';

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

async function fetchFilesAndDirs(workingDir: string): Promise<{ files: string[]; dirs: string[] }> {
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
      const { stdout: findFiles } = await execFileAsync(
        'find',
        [
          '.',
          '-maxdepth',
          '5',
          '-type',
          'f',
          '-not',
          '-path',
          '*/node_modules/*',
          '-not',
          '-path',
          '*/.git/*',
        ],
        { cwd: workingDir, maxBuffer: 10 * 1024 * 1024 },
      );
      const { stdout: findDirs } = await execFileAsync(
        'find',
        [
          '.',
          '-maxdepth',
          '5',
          '-type',
          'd',
          '-not',
          '-path',
          '*/node_modules/*',
          '-not',
          '-path',
          '*/.git/*',
          '-not',
          '-name',
          '.',
        ],
        { cwd: workingDir, maxBuffer: 10 * 1024 * 1024 },
      );

      // Strip leading "./" from find output
      files = findFiles
        .split('\n')
        .filter((p) => p.length > 0)
        .map((p) => p.replace(/^\.\//, ''));
      dirs = findDirs
        .split('\n')
        .filter((p) => p.length > 0)
        .map((p) => p.replace(/^\.\//, ''));
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
  const workingDir = (message.payload?.workingDir as string) ?? process.cwd();
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

    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      files: result,
    });
  } catch {
    connections.sendTo(connectionId, 'ACK', {
      requestId: message.requestId,
      files: [],
    });
  }
}
