import { readFile } from 'fs/promises';
import { join } from 'path';
import { getProjectSessionsPath } from './getProjectSessionsPath';

// Raw JSONL entry - passed through as-is to match Kotlin backend
type SessionMessage = Record<string, unknown>;

export async function loadSessionMessages(workingDir: string, targetSessionId: string): Promise<SessionMessage[]> {
  try {
    const sessionsPath = await getProjectSessionsPath(workingDir);
    const sessionFile = join(sessionsPath, `${targetSessionId}.jsonl`);

    const content = await readFile(sessionFile, 'utf-8');
    const lines = content.trim().split('\n');

    const messages: SessionMessage[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line) as SessionMessage;
        // Raw JSONL entry 그대로 전달 (type 필터링 제거)
        messages.push(entry);
      } catch {
        // Skip invalid JSON lines
      }
    }

    return messages;
  } catch (err) {
    console.error('[node-backend]', 'Error loading session:', err);
    return [];
  }
}
