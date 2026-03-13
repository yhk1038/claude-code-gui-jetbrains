import { join } from 'path';
import { homedir } from 'os';

export async function getProjectSessionsPath(workingDir: string): Promise<string> {
  // Match Claude CLI's zu2(): replace all non-alphanumeric chars with '-'
  const normalizedPath = workingDir.replace(/[^a-zA-Z0-9]/g, '-');
  return join(homedir(), '.claude', 'projects', normalizedPath);
}
