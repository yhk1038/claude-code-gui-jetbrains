import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync, watch } from 'fs';
import { join, dirname } from 'path';
import { getClaudeConfigDir } from './claudeConfigDir';

const claudeSettingsFile = () => join(getClaudeConfigDir(), 'settings.json');
const claudeSettingsLocalFile = () => join(getClaudeConfigDir(), 'settings.local.json');

function deepMergeSettings(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = base[key];
    const overVal = override[key];
    if (
      overVal !== null &&
      typeof overVal === 'object' &&
      !Array.isArray(overVal) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMergeSettings(
        baseVal as Record<string, unknown>,
        overVal as Record<string, unknown>,
      );
    } else {
      result[key] = overVal;
    }
  }
  return result;
}

/**
 * Read a JSON file safely, returning {} if the file doesn't exist or fails to parse.
 */
async function readJsonFileSafe(filePath: string): Promise<Record<string, unknown>> {
  try {
    if (!existsSync(filePath)) return {};
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Read ~/.claude/settings.json and settings.local.json, merge them.
 * settings.local.json takes priority over settings.json.
 * Returns empty object if files don't exist.
 */
export async function readClaudeSettings(): Promise<Record<string, unknown>> {
  try {
    const base = await readJsonFileSafe(claudeSettingsFile());
    const local = await readJsonFileSafe(claudeSettingsLocalFile());
    return { ...base, ...local };
  } catch (err) {
    console.error('[node-backend]', 'Failed to read Claude settings:', err);
    return {};
  }
}

/**
 * Write a key-value to a JSON file, preserving other keys.
 * If value is null/undefined, delete the key.
 */
async function writeKeyToJsonFile(filePath: string, key: string, value: unknown): Promise<void> {
  const current = await readJsonFileSafe(filePath);
  if (value === null || value === undefined) {
    delete current[key];
  } else {
    current[key] = value;
  }
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(current, null, 2) + '\n', 'utf-8');
}

/**
 * Remove a key from a JSON file if it exists there.
 * No-op if file doesn't exist or key is absent.
 */
async function removeKeyFromJsonFile(filePath: string, key: string): Promise<void> {
  const current = await readJsonFileSafe(filePath);
  if (!(key in current)) return;
  delete current[key];
  await writeFile(filePath, JSON.stringify(current, null, 2) + '\n', 'utf-8');
}

/**
 * Save a global Claude setting.
 * Writes to whichever file (settings.json or settings.local.json) the key lives in.
 * Deletion removes the key from both files.
 */
export async function saveClaudeSetting(
  key: string,
  value: unknown,
): Promise<{ status: 'ok' | 'error'; error?: string }> {
  try {
    await mkdir(getClaudeConfigDir(), { recursive: true });

    if (value === null || value === undefined) {
      await removeKeyFromJsonFile(claudeSettingsFile(), key);
      await removeKeyFromJsonFile(claudeSettingsLocalFile(), key);
      return { status: 'ok' };
    }

    // Write to the file where the key currently lives (local takes priority)
    const localSettings = await readJsonFileSafe(claudeSettingsLocalFile());
    if (key in localSettings) {
      await writeKeyToJsonFile(claudeSettingsLocalFile(), key, value);
    } else {
      await writeKeyToJsonFile(claudeSettingsFile(), key, value);
    }
    return { status: 'ok' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[node-backend]', 'Failed to save Claude setting:', err);
    return { status: 'error', error: msg };
  }
}

/**
 * Read project-level Claude settings from {projectPath}/.claude/settings.json
 * and {projectPath}/.claude/settings.local.json, merging local over base.
 */
export async function readProjectClaudeSettings(projectPath: string): Promise<Record<string, unknown>> {
  try {
    const base = await readJsonFileSafe(join(projectPath, '.claude', 'settings.json'));
    const local = await readJsonFileSafe(join(projectPath, '.claude', 'settings.local.json'));
    return deepMergeSettings(base, local);
  } catch (err) {
    console.error('[node-backend]', 'Failed to read project Claude settings:', err);
    return {};
  }
}

/**
 * Read merged Claude settings: global → project
 */
export async function readMergedClaudeSettings(projectPath?: string): Promise<{ settings: Record<string, unknown>; overrides: string[] }> {
  const globalSettings = await readClaudeSettings();
  if (!projectPath) {
    return { settings: globalSettings, overrides: [] };
  }
  const projectSettings = await readProjectClaudeSettings(projectPath);
  const overrides = Object.keys(projectSettings);
  return {
    settings: deepMergeSettings(globalSettings, projectSettings),
    overrides,
  };
}

/**
 * Save a Claude setting to the specified scope.
 */
export async function saveClaudeSettingToScope(
  key: string,
  value: unknown,
  scope: 'global' | 'project',
  projectPath?: string,
): Promise<{ status: 'ok' | 'error'; error?: string }> {
  if (scope === 'project') {
    if (!projectPath) return { status: 'error', error: 'projectPath required for project scope' };
    try {
      const baseFile = join(projectPath, '.claude', 'settings.json');
      const localFile = join(projectPath, '.claude', 'settings.local.json');
      await mkdir(join(projectPath, '.claude'), { recursive: true });

      if (value === null || value === undefined) {
        await removeKeyFromJsonFile(baseFile, key);
        await removeKeyFromJsonFile(localFile, key);
        return { status: 'ok' };
      }

      // Write to the file where the key currently lives (local takes priority)
      const localSettings = await readJsonFileSafe(localFile);
      if (key in localSettings) {
        await writeKeyToJsonFile(localFile, key, value);
      } else {
        await writeKeyToJsonFile(baseFile, key, value);
      }
      return { status: 'ok' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 'error', error: msg };
    }
  }
  return saveClaudeSetting(key, value);
}

// ─── API Key Detection ─────────────────────────────────────────────────────

// API 키 패턴 — env 값의 키 이름이 이 패턴에 매칭되면 API 키로 간주
const API_KEY_PATTERNS = [
  /^ANTHROPIC_API_KEY$/i,
  /^CLAUDE_API_KEY$/i,
  /^ANTHROPIC_AUTH_TOKEN$/i,
  /API_KEY$/i,
  /API_TOKEN$/i,
  /AUTH_TOKEN$/i,
];

// OAuth/API credential env keys that the Claude CLI consults BEFORE the keychain.
// If these are inherited from a parent process (e.g. Claude Desktop spawning Claude Code,
// IDE-integrated terminals, or stale env in the user's shell), the CLI will use them as-is
// and never trigger its keychain-based refresh_token flow — so once the inherited token
// expires, every call returns 401 indefinitely.
const STRIPPABLE_AUTH_ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR',
] as const;

/**
 * Decide which auth-related env keys should be stripped from the env passed to a spawned
 * Claude CLI child, given the merged Claude settings (global + project).
 *
 * Rationale: when the backend Node process inherits OAuth creds from its parent
 * (Claude Desktop, IDE, etc.), passing them through to the CLI bypasses the CLI's
 * refresh flow and pins it to a stale token. We strip them so the CLI falls back to
 * its keychain-based auth (which can refresh).
 *
 * Exception: if the user explicitly placed one of these keys in their Claude settings
 * (`env`), that's an intentional override (e.g. dev/staging API key) and we preserve it.
 */
export async function getStrippableAuthEnvKeys(workingDir?: string): Promise<string[]> {
  const { settings } = await readMergedClaudeSettings(workingDir);
  const env = settings.env;
  const explicit =
    env && typeof env === 'object' && !Array.isArray(env)
      ? new Set(Object.keys(env as Record<string, unknown>))
      : new Set<string>();
  return STRIPPABLE_AUTH_ENV_KEYS.filter((key) => !explicit.has(key));
}

/**
 * Read env from Claude settings and return API key names found.
 * Checks both ~/.claude/settings.json and settings.local.json.
 */
export async function getEnvApiKeys(): Promise<string[]> {
  const settings = await readClaudeSettings();
  const env = settings.env as Record<string, string> | undefined;
  if (!env || typeof env !== 'object' || Array.isArray(env)) return [];

  return Object.keys(env).filter((key) =>
    API_KEY_PATTERNS.some((pattern) => pattern.test(key)),
  );
}

// ─── File Watcher ──────────────────────────────────────────────────────────

let watcherInstance: ReturnType<typeof watch> | null = null;
let debounceTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 300;

/**
 * Watch ~/.claude/settings.json for external changes
 * Calls onFileChange callback when file is modified
 *
 * Usage:
 *   watchClaudeSettingsFile((settings) => {
 *     connections.broadcastToAll('CLAUDE_SETTINGS_CHANGED', { settings });
 *   });
 */
export function watchClaudeSettingsFile(onFileChange: (settings: Record<string, unknown>) => void): void {
  // Prevent duplicate watchers
  if (watcherInstance) {
    console.log('[node-backend]', 'Claude settings file watcher already started');
    return;
  }

  try {
    const settingsDir = getClaudeConfigDir();

    watcherInstance = watch(settingsDir, async (eventType, filename) => {
      // Only watch settings.json file
      if (filename !== 'settings.json') {
        return;
      }

      // Debounce multiple rapid file changes (fs.watch can trigger multiple times)
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        try {
          const settings = await readClaudeSettings();
          console.log('[node-backend]', 'Claude settings file changed, broadcasting:', settings);
          onFileChange(settings);
        } catch (err) {
          console.error('[node-backend]', 'Error reading Claude settings after file change:', err);
        }
      }, DEBOUNCE_MS);
    });

    console.log('[node-backend]', `Watching ${claudeSettingsFile()} for changes`);
  } catch (err) {
    console.error('[node-backend]', 'Failed to start Claude settings file watcher:', err);
  }
}

/**
 * Stop watching Claude settings file
 */
export function stopWatchingClaudeSettingsFile(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (watcherInstance) {
    watcherInstance.close();
    watcherInstance = null;
    console.log('[node-backend]', 'Claude settings file watcher stopped');
  }
}
