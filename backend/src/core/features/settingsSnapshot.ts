import { homedir } from 'os';
import { readMergedSettings } from './settings';
import { readMergedClaudeSettings } from './claude-settings';
import type { TelemetryProperties } from './telemetry';

// 세션 시작 텔레메트리에 실을 설정 스냅샷을 만든다. 흩어진 설정(앱 settings.js +
// Claude settings)을 종합하되, Rybbit이 집계할 수 있도록 평탄한 원시값으로 추리고,
// 경로는 홈 디렉토리를 '~'로 치환해 username 등 개인정보를 제거한다. 세션 제목/내용,
// 미치환 경로 등은 절대 담지 않는다.

/** 홈 디렉토리를 '~'로 치환한다(username 등 개인정보 제거). 문자열이 아니면 undefined. */
function sanitizePath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const home = homedir();
  return value.startsWith(home) ? `~${value.slice(home.length)}` : value;
}

/** 원시값(string/number/boolean)만 통과시킨다. 그 외(null·객체 등)는 undefined. */
function asPrimitive(value: unknown): string | number | boolean | undefined {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? value
    : undefined;
}

export async function buildSettingsSnapshot(workingDir?: string): Promise<TelemetryProperties> {
  const app = (await readMergedSettings(workingDir)).settings;
  const claude = (await readMergedClaudeSettings(workingDir)).settings;
  const snapshot: TelemetryProperties = {};

  const put = (key: string, value: string | number | boolean | undefined) => {
    if (value !== undefined) snapshot[key] = value;
  };

  // 선택지·수치형 (개인 식별 X)
  put('theme', asPrimitive(app.theme));
  put('fontSize', asPrimitive(app.fontSize));
  put('autoScrollThreshold', asPrimitive(app.autoScrollThreshold));
  put('debugMode', asPrimitive(app.debugMode));
  put('logLevel', asPrimitive(app.logLevel));
  put('hostMode', asPrimitive(app.hostMode));
  put('language', asPrimitive(claude.language));
  put('model', asPrimitive(claude.model));

  // permissions.defaultMode (중첩 객체에서 한 값만)
  const permissions = claude.permissions;
  if (permissions !== null && typeof permissions === 'object' && !Array.isArray(permissions)) {
    put('defaultMode', asPrimitive((permissions as Record<string, unknown>).defaultMode));
  }

  // 경로 (홈→'~' 치환, username 제거)
  put('cliPath', sanitizePath(app.cliPath));
  put('nodePath', sanitizePath(app.nodePath));
  put('terminalApp', sanitizePath(app.terminalApp));

  return snapshot;
}
