import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const OVERRIDES_FILE = '.claude-code-gui-session-titles.json';

type TitleOverrides = Record<string, string>;

function getOverridesFile(sessionsPath: string): string {
  return join(sessionsPath, OVERRIDES_FILE);
}

export async function readSessionTitleOverrides(sessionsPath: string): Promise<TitleOverrides> {
  try {
    const raw = await readFile(getOverridesFile(sessionsPath), 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    ) as TitleOverrides;
  } catch {
    return {};
  }
}

export async function writeSessionTitleOverride(
  sessionsPath: string,
  sessionId: string,
  title: string,
): Promise<void> {
  await mkdir(sessionsPath, { recursive: true });
  const overrides = await readSessionTitleOverrides(sessionsPath);
  overrides[sessionId] = title;
  await writeFile(getOverridesFile(sessionsPath), JSON.stringify(overrides, null, 2), 'utf-8');
}

export async function removeSessionTitleOverride(
  sessionsPath: string,
  sessionId: string,
): Promise<void> {
  const overrides = await readSessionTitleOverrides(sessionsPath);
  if (!(sessionId in overrides)) return;
  delete overrides[sessionId];
  await writeFile(getOverridesFile(sessionsPath), JSON.stringify(overrides, null, 2), 'utf-8');
}
