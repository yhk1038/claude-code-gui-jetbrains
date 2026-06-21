import { homedir } from 'os';
import { gzipSync } from 'zlib';
import { readMergedSettings } from './settings';
import { readMergedClaudeSettings } from './claude-settings';

// 텔레메트리에 실을 설정 스냅샷. 흩어진 설정(앱 settings.js + Claude settings)을 종합해
// **객체 전체**를 JSON으로 직렬화한다(키를 거르지 않는다 — 재현이 목적). 경로에 섞인
// 개인정보(홈 디렉토리 username 등)는 모든 문자열에서 '~'로 치환한다.
//
// Rybbit properties는 2048자 제한이라 큰 settings가 안 들어간다. 그래서 settings는
// gzip+base64로 압축한 뒤, Rybbit의 feature_flags(value도 2048 제한)에 청크로 쪼개
// { settings_0, settings_1, ... }로 싣는다(사실상 무제한). feature_flags 칸을 빌려 쓰는
// 것이며(우리는 Rybbit feature flag 기능을 안 씀), 나중에 우리 api+Postgres가 생기면
// settings는 그쪽으로 이전한다.
//
// 재현 시 디코딩(settings_* 정렬·연결 → base64 → gunzip → JSON)은 사용자가 직접 하지 않고
// 에이전트가 수행한다(부모 CLAUDE.md / 메모리 참조).

// feature_flags value 제한(2048)에 여유를 둔 청크 크기.
const SETTINGS_CHUNK_SIZE = 1900;

/** 경로 문자열의 홈 디렉토리를 '~'로 치환한다(시작 일치). 문자열이 아니면 undefined. */
export function sanitizePath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const home = homedir();
  return value.startsWith(home) ? `~${value.slice(home.length)}` : value;
}

// settings는 Record<string, unknown>이라 값이 unknown이다(기존 settings.ts와 동일). 재귀적으로
// 모든 문자열 값의 홈 경로만 '~'로 치환하고 구조는 그대로 보존한다.
function sanitizeDeep(value: unknown): unknown {
  if (typeof value === 'string') {
    const home = homedir();
    return home.length > 0 ? value.split(home).join('~') : value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeDeep);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = sanitizeDeep(v);
    }
    return out;
  }
  return value;
}

export interface SettingsSnapshot {
  /** 압축 settings를 feature_flags value(2048) 제한에 맞춰 쪼갠 청크. { settings_0, settings_1, ... } */
  settingsChunks: Record<string, string>;
  /** 터미널 설정값(홈치환). 미설정이면 undefined. */
  terminal: string | undefined;
}

/**
 * 앱 + Claude 설정을 종합해 스냅샷(설정 청크 + terminal)을 만든다.
 * NOTE: 현재 텔레메트리 전송 경로에서는 미사용(Rybbit 한도로 settings 전송 보류).
 * 추후 자체 api+Postgres로 settings를 이전할 때 재사용한다(메모리 ccg-telemetry-settings).
 */
export async function buildSettingsSnapshot(): Promise<SettingsSnapshot> {
  const app = (await readMergedSettings()).settings;
  const claude = (await readMergedClaudeSettings()).settings;
  const merged = { ...app, ...claude };
  const json = JSON.stringify(sanitizeDeep(merged));
  const compressed = gzipSync(Buffer.from(json, 'utf-8')).toString('base64');

  const settingsChunks: Record<string, string> = {};
  for (let i = 0; i * SETTINGS_CHUNK_SIZE < compressed.length; i++) {
    settingsChunks[`settings_${i}`] = compressed.slice(
      i * SETTINGS_CHUNK_SIZE,
      (i + 1) * SETTINGS_CHUNK_SIZE,
    );
  }

  return { settingsChunks, terminal: sanitizePath(app.terminalApp) };
}
