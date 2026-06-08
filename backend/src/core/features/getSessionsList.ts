import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { extractSessionInfo, type SessionInfo } from './extractSessionInfo';
import { getProjectSessionsPath } from './getProjectSessionsPath';

export type SessionListEntry = SessionInfo & { sessionId: string };

// Cap parallel JSONL reads so file descriptors and event-loop slices stay
// bounded even when a project has hundreds of session files.
const READ_CONCURRENCY = 10;

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const idx = nextIndex++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function getSessionsList(workingDir: string): Promise<SessionListEntry[]> {
  console.error('[node-backend]', 'getSessionsList workingDir:', workingDir);

  try {
    const sessionsPath = await getProjectSessionsPath(workingDir);
    console.error('[getSessionsList]', 'looking in:', sessionsPath);

    if (!existsSync(sessionsPath)) {
      console.error('[node-backend]', 'Sessions dir not found:', sessionsPath);
      return [];
    }

    // Scan all .jsonl files in directory (Cursor approach)
    const files = await readdir(sessionsPath);
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

    console.error('[node-backend]', 'Found .jsonl files:', jsonlFiles.length);

    const maybeSessions = await mapWithLimit(jsonlFiles, READ_CONCURRENCY, async (file) => {
      try {
        const sessionId = file.replace(/\.jsonl$/, '');
        const fullPath = join(sessionsPath, file);
        const sessionInfo = await extractSessionInfo(fullPath);
        return { sessionId, ...sessionInfo } satisfies SessionListEntry;
      } catch (err) {
        console.error('[node-backend]', 'Failed to parse session file:', file, err);
        return null;
      }
    });

    const sessions = maybeSessions.filter((s): s is SessionListEntry => s !== null);

    // Sort by lastTimestamp descending
    sessions.sort((a, b) => {
      const aTime = new Date(a.lastTimestamp ?? a.createdAt).getTime();
      const bTime = new Date(b.lastTimestamp ?? b.createdAt).getTime();
      return bTime - aTime;
    });

    console.error('[node-backend]', 'Returning sessions count:', sessions.length);
    return sessions;
  } catch (err) {
    console.error('[node-backend]', 'Error reading sessions:', err);
    return [];
  }
}
