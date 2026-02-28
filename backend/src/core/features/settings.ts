import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ─── Settings helpers ────────────────────────────────────────────────────────

const SETTINGS_FILE = join(homedir(), '.claude-code-gui', 'settings.js');

const DEFAULT_SETTINGS: Record<string, unknown> = {
  cliPath: null,
  permissionMode: 'ALWAYS_ASK',
  autoApplyLowRisk: false,
  theme: 'system',
  fontSize: 13,
  debugMode: false,
  logLevel: 'info',
  initialInputMode: 'ask_before_edit',
};

const COMMENT_MAP: Record<string, string> = {
  cliPath: 'Claude CLI 실행 파일 경로 (null이면 자동 감지)',
  permissionMode: '권한 모드: "ALWAYS_ASK" | "AUTO_APPROVE_SAFE" | "AUTO_APPROVE_ALL"',
  autoApplyLowRisk: '저위험 변경사항 자동 적용 여부',
  theme: '테마: "system" | "light" | "dark"',
  fontSize: '글꼴 크기 (8~32)',
  debugMode: '디버그 모드 활성화',
  logLevel: '로그 레벨: "debug" | "info" | "warn" | "error"',
  initialInputMode: '기본 입력 모드: "plan" | "bypass" | "ask_before_edit" | "auto_edit"',
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

interface SaveResult {
  status: 'ok' | 'error';
  error?: string;
}

function validateSetting(key: string, value: unknown): string | null {
  if (!(key in DEFAULT_SETTINGS)) {
    return `Unknown settings key: ${key}`;
  }
  switch (key) {
    case 'permissionMode':
      if (!['ALWAYS_ASK', 'AUTO_APPROVE_SAFE', 'AUTO_APPROVE_ALL'].includes(value as string)) {
        return 'permissionMode must be one of "ALWAYS_ASK", "AUTO_APPROVE_SAFE", "AUTO_APPROVE_ALL"';
      }
      break;
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
    case 'autoApplyLowRisk':
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
    case 'initialInputMode':
      if (!['plan', 'bypass', 'ask_before_edit', 'auto_edit'].includes(value as string)) {
        return 'initialInputMode must be one of "plan", "bypass", "ask_before_edit", "auto_edit"';
      }
      break;
    case 'cliPath':
      if (value !== null && typeof value !== 'string') {
        return 'cliPath must be a string or null';
      }
      break;
  }
  return null;
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
