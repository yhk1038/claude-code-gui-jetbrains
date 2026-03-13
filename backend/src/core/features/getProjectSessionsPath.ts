import { join } from 'path';
import { homedir } from 'os';

/** OS 중립적 경로 정규화: 비영문자/비숫자를 모두 '-'로 치환 */
export function normalizeProjectPath(workingDir: string): string {
  return workingDir.replace(/[^a-zA-Z0-9]/g, '-');
}

export async function getProjectSessionsPath(workingDir: string): Promise<string> {
  return join(homedir(), '.claude', 'projects', normalizeProjectPath(workingDir));
}
