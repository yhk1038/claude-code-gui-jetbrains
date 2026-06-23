import { createReadStream } from 'fs';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { createInterface } from 'readline';
import { getClaudeConfigDir } from './claudeConfigDir';

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

interface SessionsIndex {
  entries?: SessionsIndexEntry[];
}

interface JsonlFirstLine {
  cwd?: string;
  timestamp?: string;
}

/** JSONL 파일에서 cwd 필드가 있는 첫 번째 줄을 찾아 파싱한다. (최대 MAX_LINES줄) */
function readCwdFromJsonl(filePath: string): Promise<JsonlFirstLine> {
  const MAX_LINES = 10;
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { encoding: 'utf-8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    let resolved = false;
    let lineCount = 0;

    rl.on('line', (line) => {
      lineCount++;
      try {
        const parsed = JSON.parse(line) as JsonlFirstLine;
        if (parsed.cwd) {
          resolved = true;
          rl.close();
          stream.destroy();
          resolve(parsed);
          return;
        }
      } catch {
        // malformed line, skip
      }
      if (lineCount >= MAX_LINES) {
        resolved = true;
        rl.close();
        stream.destroy();
        resolve({});
      }
    });

    rl.once('close', () => {
      if (!resolved) resolve({});
    });

    stream.once('error', reject);
  });
}

/**
 * sessions-index.json이 없거나 파싱 실패 시, 폴더 내 JSONL 파일의 첫 줄에서
 * cwd를 추출하여 ProjectEntry 목록을 생성한다.
 */
async function buildEntriesFromJsonl(folderPath: string): Promise<ProjectEntry[]> {
  let files: string[];
  try {
    files = (await readdir(folderPath)).filter((f) => f.endsWith('.jsonl'));
  } catch {
    return [];
  }

  if (files.length === 0) return [];

  // projectPath → { sessionCount, lastModified } 집계
  const grouped = new Map<string, { count: number; lastModified: number }>();

  for (const file of files) {
    const filePath = join(folderPath, file);
    try {
      const firstLine = await readCwdFromJsonl(filePath);
      const cwd = firstLine.cwd;
      if (!cwd) continue;

      const ts = firstLine.timestamp ? new Date(firstLine.timestamp).getTime() : Date.now();
      const existing = grouped.get(cwd);
      if (existing) {
        existing.count += 1;
        if (ts > existing.lastModified) existing.lastModified = ts;
      } else {
        grouped.set(cwd, { count: 1, lastModified: ts });
      }
    } catch {
      // 읽기 실패한 JSONL은 건너뜀
    }
  }

  return Array.from(grouped.entries()).map(([projectPath, { count, lastModified }]) => ({
    name: projectPath.split('/').pop() || projectPath,
    path: projectPath,
    sessionCount: count,
    lastModified: new Date(lastModified).toISOString(),
  }));
}

export async function getProjectsList(): Promise<ProjectEntry[]> {
  try {
    const projectsDir = join(getClaudeConfigDir(), 'projects');
    const entries = await readdir(projectsDir, { withFileTypes: true });

    const projects: ProjectEntry[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;

      const folderPath = join(projectsDir, entry.name);
      const indexPath = join(folderPath, 'sessions-index.json');

      let parsed: SessionsIndex | null = null;
      try {
        const indexContent = await readFile(indexPath, 'utf-8');
        parsed = JSON.parse(indexContent) as SessionsIndex;
      } catch {
        // sessions-index.json 없음 → JSONL fallback으로 처리
      }

      if (parsed !== null) {
        // sessions-index.json 파싱 성공 → projectPath 기준으로 group by
        const validEntries = (parsed.entries ?? []).filter((e) => !e.isSidechain);

        if (validEntries.length === 0) {
          // 유효 엔트리 없음 → JSONL fallback 시도
          const fallback = await buildEntriesFromJsonl(folderPath);
          projects.push(...fallback);
          continue;
        }

        // projectPath → { count, lastModified } 집계
        const grouped = new Map<string, { count: number; lastModified: number }>();
        for (const e of validEntries) {
          const projectPath = e.projectPath;
          if (!projectPath) continue;

          const ts =
            e.modified || e.created
              ? new Date(e.modified ?? e.created ?? '').getTime()
              : Date.now();

          const existing = grouped.get(projectPath);
          if (existing) {
            existing.count += 1;
            if (ts > existing.lastModified) existing.lastModified = ts;
          } else {
            grouped.set(projectPath, { count: 1, lastModified: ts });
          }
        }

        if (grouped.size === 0) {
          // projectPath가 없는 엔트리만 있었던 경우 → JSONL fallback
          const fallback = await buildEntriesFromJsonl(folderPath);
          projects.push(...fallback);
          continue;
        }

        for (const [projectPath, { count, lastModified }] of grouped.entries()) {
          projects.push({
            name: projectPath.split('/').pop() || projectPath,
            path: projectPath,
            sessionCount: count,
            lastModified: new Date(lastModified).toISOString(),
          });
        }
      } else {
        // sessions-index.json 없음 → JSONL fallback
        const fallback = await buildEntriesFromJsonl(folderPath);
        if (fallback.length === 0) continue; // 실제 세션 없음 → skip
        projects.push(...fallback);
      }
    }

    // lastModified 내림차순 정렬
    projects.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    return projects;
  } catch (err) {
    console.error('[node-backend]', 'Error reading projects list:', err);
    return [];
  }
}
