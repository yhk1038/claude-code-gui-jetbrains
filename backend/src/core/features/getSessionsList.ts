import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { extractSessionInfo, type SessionInfo } from './extractSessionInfo';
import { getProjectSessionsPath } from './getProjectSessionsPath';

export type SessionListEntry = SessionInfo & { sessionId: string };

export async function getSessionsList(workingDir: string): Promise<SessionListEntry[]> {
  console.error('[node-backend]', 'getSessionsList workingDir:', workingDir);

  try {
    const sessionsPath = await getProjectSessionsPath(workingDir);

    if (!existsSync(sessionsPath)) {
      console.error('[node-backend]', 'Sessions dir not found:', sessionsPath);
      return [];
    }

    // Scan all .jsonl files in directory (Cursor approach)
    const files = await readdir(sessionsPath);
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

    console.error('[node-backend]', 'Found .jsonl files:', jsonlFiles.length);

    const sessions: SessionListEntry[] = [];

    for (const file of jsonlFiles) {
      try {
        const sessionId = file.replace(/\.jsonl$/, '');
        const fullPath = join(sessionsPath, file);
        const sessionInfo = await extractSessionInfo(fullPath);

        sessions.push({
          sessionId,
          ...sessionInfo,
        });
      } catch (err) {
        console.error('[node-backend]', 'Failed to parse session file:', file, err);
      }
    }

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
