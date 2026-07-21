import { join } from 'path';
import { getClaudeConfigDir } from './claudeConfigDir';
import { isWslUncPath, toWslPath } from '../wsl-path';

/** OS 중립적 경로 정규화: 비영문자/비숫자를 모두 '-'로 치환 */
export function normalizeProjectPath(workingDir: string): string {
  return workingDir.replace(/[^a-zA-Z0-9]/g, '-');
}

export async function getProjectSessionsPath(workingDir: string): Promise<string> {
  // A WSL backend (running inside the distro, platform === 'linux') is handed the
  // project as a Windows UNC path (//wsl.localhost/Ubuntu/home/...). The claude CLI
  // ran inside the distro and named its sessions dir from the INNER Linux path
  // (/home/...), so we must convert BEFORE encoding — mirroring resolveWslCwd on the
  // spawn side. Without this the encoded name (--wsl-localhost-...) never matches the
  // CLI's (-home-...), and the GUI shows "No sessions yet" despite valid files (#175).
  const dir =
    process.platform === 'linux' && isWslUncPath(workingDir)
      ? toWslPath(workingDir) ?? workingDir
      : workingDir;
  return join(getClaudeConfigDir(), 'projects', normalizeProjectPath(dir));
}
