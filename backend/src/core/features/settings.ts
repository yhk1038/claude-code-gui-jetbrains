import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ─── Settings helpers ────────────────────────────────────────────────────────

const SETTINGS_FILE = join(homedir(), '.claude-code-gui', 'settings.js');

const DEFAULT_SETTINGS: Record<string, unknown> = {
  cliPath: null,
  nodePath: null,
  theme: 'system',
  fontSize: 13,
  autoScrollThreshold: 80,
  debugMode: false,
  logLevel: 'info',
  terminalApp: null,
  hostMode: 'editor-tab',
};

const COMMENT_MAP: Record<string, string> = {
  cliPath: 'Claude CLI 실행 파일 경로 (null이면 자동 감지)',
  nodePath: 'Node.js 실행 파일 경로 (null이면 자동 감지, 변경 시 재시작 필요)',
  theme: '테마: "system" | "light" | "dark"',
  fontSize: '글꼴 크기 (8~32)',
  autoScrollThreshold: '자동 스크롤 임계점(px). 메시지 끝에서 이 거리 안에 있을 때만 스트림을 따라 내려간다',
  debugMode: '디버그 모드 활성화',
  logLevel: '로그 레벨: "debug" | "info" | "warn" | "error"',
  terminalApp: '터미널 프로그램 (null이면 OS 기본 터미널)',
  hostMode: '채팅을 띄우는 자리: "editor-tab" | "tool-window"',
};

function generateSettingsContent(settings: Record<string, unknown>): string {
  const lines: string[] = ['export default {'];
  const keys = Object.keys(DEFAULT_SETTINGS);
  for (const key of keys) {
    const value = key in settings ? settings[key] : DEFAULT_SETTINGS[key];
    const comment = COMMENT_MAP[key];
    if (comment) {
      lines.push(`  // ${comment}`);
    }
    const serialized = value === null ? 'null' : JSON.stringify(value);
    lines.push(`  ${key}: ${serialized},`);
  }
  lines.push('};');
  return lines.join('\n') + '\n';
}

export async function readSettingsFile(): Promise<Record<string, unknown>> {
  try {
    if (!existsSync(SETTINGS_FILE)) {
      // Create with defaults
      await mkdir(join(homedir(), '.claude-code-gui'), { recursive: true });
      await writeFile(SETTINGS_FILE, generateSettingsContent(DEFAULT_SETTINGS), 'utf-8');
      return { ...DEFAULT_SETTINGS };
    }

    const raw = await readFile(SETTINGS_FILE, 'utf-8');

    // Strip block comments
    let stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '');

    // Strip line comments (preserving strings)
    stripped = stripped.replace(/\/\/[^\n]*/g, '');

    // Remove `export default` prefix and trailing semicolon
    stripped = stripped.replace(/^\s*export\s+default\s*/, '').replace(/;\s*$/, '').trim();

    // Add quotes to unquoted keys: word chars followed by colon
    stripped = stripped.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":');

    // Remove trailing commas before closing braces/brackets
    stripped = stripped.replace(/,\s*([\]}])/g, '$1');

    const parsed = JSON.parse(stripped) as Record<string, unknown>;

    // Merge with defaults so missing keys get default values
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.error('[node-backend]', 'Failed to read settings file, using defaults:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

export interface SaveResult {
  status: 'ok' | 'error';
  error?: string;
}

function validateSetting(key: string, value: unknown): string | null {
  if (!(key in DEFAULT_SETTINGS)) {
    return `Unknown settings key: ${key}`;
  }
  switch (key) {
    case 'theme':
      if (!['system', 'light', 'dark'].includes(value as string)) {
        return 'theme must be one of "system", "light", "dark"';
      }
      break;
    case 'fontSize': {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 8 || n > 32) {
        return 'fontSize must be an integer between 8 and 32';
      }
      break;
    }
    case 'autoScrollThreshold': {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) {
        return 'autoScrollThreshold must be a positive integer';
      }
      break;
    }
    case 'debugMode':
      if (typeof value !== 'boolean') {
        return `${key} must be a boolean`;
      }
      break;
    case 'logLevel':
      if (!['debug', 'info', 'warn', 'error'].includes(value as string)) {
        return 'logLevel must be one of "debug", "info", "warn", "error"';
      }
      break;
    case 'cliPath':
      if (value !== null && typeof value !== 'string') {
        return 'cliPath must be a string or null';
      }
      break;
    case 'nodePath':
      if (value !== null && typeof value !== 'string') {
        return 'nodePath must be a string or null';
      }
      break;
    case 'terminalApp':
      if (value !== null && typeof value !== 'string') {
        return 'terminalApp must be a string or null';
      }
      break;
    case 'hostMode':
      if (!['editor-tab', 'tool-window'].includes(value as string)) {
        return 'hostMode must be one of "editor-tab", "tool-window"';
      }
      break;
  }
  return null;
}

/**
 * Read project-level app settings.
 * Project settings use JSON format: {projectPath}/.claude-code-gui/settings.json
 */
export async function readProjectSettings(projectPath: string): Promise<Record<string, unknown>> {
  const filePath = join(projectPath, '.claude-code-gui', 'settings.json');
  try {
    if (!existsSync(filePath)) return {};
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    console.error('[node-backend]', 'Failed to read project settings:', err);
    return {};
  }
}

/**
 * Read merged settings: DEFAULT → global → project
 */
export async function readMergedSettings(projectPath?: string): Promise<{ settings: Record<string, unknown>; overrides: string[] }> {
  const globalSettings = await readSettingsFile();
  if (!projectPath) {
    return { settings: globalSettings, overrides: [] };
  }
  const projectSettings = await readProjectSettings(projectPath);
  const overrides = Object.keys(projectSettings);
  return {
    settings: { ...globalSettings, ...projectSettings },
    overrides,
  };
}

/**
 * Save a setting to the specified scope.
 * For project scope, saves to {projectPath}/.claude-code-gui/settings.json
 */
export async function saveSettingToScope(
  key: string,
  value: unknown,
  scope: 'global' | 'project',
  projectPath?: string,
): Promise<SaveResult> {
  if (scope === 'project') {
    if (!projectPath) return { status: 'error', error: 'projectPath required for project scope' };
    const validationError = validateSetting(key, value);
    if (validationError) return { status: 'error', error: validationError };

    try {
      const filePath = join(projectPath, '.claude-code-gui', 'settings.json');
      let current: Record<string, unknown> = {};
      try {
        if (existsSync(filePath)) {
          current = JSON.parse(await readFile(filePath, 'utf-8')) as Record<string, unknown>;
        }
      } catch { /* start fresh */ }
      current[key] = value;
      await mkdir(join(projectPath, '.claude-code-gui'), { recursive: true });
      await writeFile(filePath, JSON.stringify(current, null, 2) + '\n', 'utf-8');
      return { status: 'ok' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 'error', error: msg };
    }
  }
  // global scope: use existing saveSettingToFile
  return saveSettingToFile(key, value);
}

export async function saveSettingToFile(key: string, value: unknown): Promise<SaveResult> {
  const validationError = validateSetting(key, value);
  if (validationError) {
    return { status: 'error', error: validationError };
  }

  try {
    const current = await readSettingsFile();
    current[key] = value;
    await mkdir(join(homedir(), '.claude-code-gui'), { recursive: true });
    await writeFile(SETTINGS_FILE, generateSettingsContent(current), 'utf-8');
    return { status: 'ok' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[node-backend]', 'Failed to save setting:', err);
    return { status: 'error', error: msg };
  }
}
