import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

interface ProjectEntry {
  name: string;       // 폴더 이름 (프로젝트 이름)
  path: string;       // 전체 경로 (워킹 디렉토리)
  sessionCount: number;
  lastModified: string;
}

interface SessionsIndexEntry {
  isSidechain?: boolean;
  projectPath?: string;
  modified?: string;
  created?: string;
}

export async function getProjectsList(): Promise<ProjectEntry[]> {
  try {
    const projectsDir = join(homedir(), '.claude', 'projects');
    const entries = await readdir(projectsDir, { withFileTypes: true });

    const projects: ProjectEntry[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue; // hidden folders

      // Try to read sessions-index.json to get project path and session count
      let path: string | null = null;
      let sessionCount = 0;
      let lastModified = new Date().toISOString();

      try {
        const indexPath = join(projectsDir, entry.name, 'sessions-index.json');
        const indexContent = await readFile(indexPath, 'utf-8');
        const index = JSON.parse(indexContent) as { entries?: SessionsIndexEntry[] };
        const validEntries = (index.entries || []).filter((e: SessionsIndexEntry) => !e.isSidechain);
        sessionCount = validEntries.length;

        // Get projectPath from first valid entry
        if (validEntries.length > 0 && validEntries[0].projectPath) {
          path = validEntries[0].projectPath;
        }

        // Get the most recent modified date
        if (validEntries.length > 0) {
          const dates = validEntries.map((e: SessionsIndexEntry) => new Date(e.modified || e.created || '').getTime());
          lastModified = new Date(Math.max(...dates)).toISOString();
        }
      } catch {
        // No sessions-index.json or no valid entries, skip this project
        continue;
      }

      // Skip if we couldn't determine the project path
      if (!path) continue;

      const name = path.split('/').pop() || path;

      projects.push({
        name,
        path,
        sessionCount,
        lastModified,
      });
    }

    // Sort by lastModified descending
    projects.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    return projects;
  } catch (err) {
    console.error('[node-backend]', 'Error reading projects list:', err);
    return [];
  }
}
