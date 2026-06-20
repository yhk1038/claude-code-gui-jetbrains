import { readProfile, ConsentStatus } from './profile';

// ─── Telemetry transport (Rybbit) ────────────────────────────────────────────
// Sends custom events / errors to the self-hosted Rybbit instance, but ONLY when
// telemetry consent status is ACCEPTED. The API key is injected at build time
// (esbuild define) — never committed as a source constant. The Bearer key makes
// Rybbit treat these as trusted server-side ingestion (bypasses its bot filter).

const RYBBIT_HOST = 'https://ccg-telemetry.01republic.io';
const RYBBIT_SITE_ID = '2a8b407c8941';
const TRACK_ENDPOINT = `${RYBBIT_HOST}/api/track`;
// Build-time injected via esbuild define. Empty in dev unless CCG_RYBBIT_API_KEY is set.
const RYBBIT_API_KEY = process.env.CCG_RYBBIT_API_KEY ?? '';

/** Rybbit track payload type. */
enum TrackType {
  EVENT = 'custom_event',
  ERROR = 'error',
}

/** 이벤트에 실어 보낼 부가 속성. 원시값만 허용한다. */
export interface TelemetryProperties {
  [key: string]: string | number | boolean;
}

/**
 * 동의(ACCEPTED)일 때만 Rybbit으로 전송한다. 그 외(미응답·거부·철회)에는 아무것도 보내지 않는다.
 * API key가 주입되지 않은 빌드(개발 등)에서도 전송하지 않는다. 전송 실패는 조용히 무시한다.
 */
async function send(
  type: TrackType,
  eventName: string,
  properties: TelemetryProperties,
): Promise<void> {
  if (!RYBBIT_API_KEY) return; // 키 미주입 빌드 — 전송 안 함
  const profile = await readProfile();
  if (profile.telemetryConsent.status !== ConsentStatus.ACCEPTED) return; // 미수락이면 전송 0

  const body = {
    site_id: RYBBIT_SITE_ID,
    type,
    event_name: eventName,
    // Rybbit은 properties를 JSON 문자열로 받는다. 가명 식별자(uuid)를 함께 싣는다.
    properties: JSON.stringify({ ...properties, uuid: profile.uuid }),
    hostname: 'jetbrains.claude-code-gui.com',
    pathname: '/',
  };

  try {
    await fetch(TRACK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RYBBIT_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    // 텔레메트리 전송 실패는 사용자 경험에 영향을 주지 않도록 무시한다.
  }
}

/** 커스텀 이벤트를 전송한다(동의 시에만). */
export async function trackEvent(
  eventName: string,
  properties: TelemetryProperties = {},
): Promise<void> {
  await send(TrackType.EVENT, eventName, properties);
}

/** 에러를 전송한다(동의 시에만). */
export async function trackError(
  error: Error,
  context: TelemetryProperties = {},
): Promise<void> {
  await send(TrackType.ERROR, error.name || 'Error', {
    message: error.message,
    ...context,
  });
}
