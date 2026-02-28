import { join } from 'path';
import { homedir } from 'os';

export async function getProjectSessionsPath(workingDir: string): Promise<string> {
  // Convert project path to Claude's folder format (keeps leading dash)
  const normalizedPath = workingDir.replace(/\//g, '-');
  return join(homedir(), '.claude', 'projects', normalizedPath);
}
