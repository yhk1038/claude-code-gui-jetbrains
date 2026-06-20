import { readProfile, ConsentStatus } from './profile';
import { homedir } from 'os';

// ─── Telemetry transport (Rybbit) ────────────────────────────────────────────
// Sends custom events / errors to the self-hosted Rybbit instance, but ONLY when
// telemetry consent status is ACCEPTED. The API key is injected at build time
// (esbuild define) — never committed as a source constant. The Bearer key makes
// Rybbit treat these as trusted server-side ingestion (bypasses its bot filter).
//
// Transport rules (apply to EVERY event):
//   1. Any error (network, fs, parsing, ...) is swallowed so it can never affect
//      the app — the whole body is wrapped in a single try/catch.
//   2. Callers MUST NOT await these functions or chain then/catch/finally. They
//      are fire-and-forget; nothing depends on the transmission result.

const RYBBIT_HOST = 'https://ccg-telemetry.01republic.io';
const RYBBIT_SITE_ID = '2a8b407c8941';
const TRACK_ENDPOINT = `${RYBBIT_HOST}/api/track`;
// Build-time injected via esbuild define. Empty in dev unless CCG_RYBBIT_API_KEY is set.
const RYBBIT_API_KEY = process.env.CCG_RYBBIT_API_KEY ?? '';
// 전송 자체 실패를 보고하는 에러 이벤트 이름. 무한루프 방지용 재귀 가드의 기준이 된다.
const TRANSPORT_ERROR_EVENT = 'telemetry_transport_error';

/** Rybbit track payload type. */
enum TrackType {
  EVENT = 'custom_event',
  ERROR = 'error',
}

/** 이벤트에 실어 보낼 부가 속성. 원시값만 허용한다. */
export interface TelemetryProperties {
  [key: string]: string | number | boolean;
}

/** 전송 옵션. requireConsent=false는 동의 철회 사실처럼 "이전 동의 하에" 보내는 특수 경우에만 사용. */
export interface TelemetryOptions {
  requireConsent?: boolean;
}

/** 텍스트 내 홈 디렉토리 경로를 '~'로 치환한다(에러 메시지·스택의 username 등 개인정보 제거). */
function sanitizeText(text: string): string {
  const home = homedir();
  return home.length > 0 ? text.split(home).join('~') : text;
}

/**
 * 단일 try/catch로 감싸 어떤 에러도 앱에 새지 않게 한다(규칙 1). 호출자는 await하지
 * 않으므로(규칙 2) 이 함수의 내부 await는 앱 실행을 지연시키지 않는다.
 * 전송 자체가 실패하면 그 사실도 에러 이벤트(TRANSPORT_ERROR_EVENT)로 보고하되,
 * 그 보고가 또 실패하면 재보고하지 않는다(재귀 가드).
 */
async function send(
  type: TrackType,
  eventName: string,
  properties: TelemetryProperties,
  options: TelemetryOptions,
): Promise<void> {
  try {
    if (!RYBBIT_API_KEY) return; // 키 미주입 빌드 — 전송 안 함
    const profile = await readProfile();
    const requireConsent = options.requireConsent ?? true;
    if (requireConsent && profile.telemetryConsent.status !== ConsentStatus.ACCEPTED) return;

    const body = {
      site_id: RYBBIT_SITE_ID,
      type,
      event_name: eventName,
      // Rybbit은 properties를 JSON 문자열로 받는다. 가명 식별자(uuid)를 함께 싣는다.
      properties: JSON.stringify({ ...properties, uuid: profile.uuid }),
      hostname: 'jetbrains.claude-code-gui.com',
      pathname: '/',
    };

    await fetch(TRACK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RYBBIT_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // 전송 자체 에러도 디버깅용 에러 이벤트로 보고한다(재귀 가드: transport error 보고는 재시도 안 함).
    if (eventName !== TRANSPORT_ERROR_EVENT) {
      const message = err instanceof Error ? sanitizeText(err.message) : String(err);
      void send(TrackType.ERROR, TRANSPORT_ERROR_EVENT, { message, failedEvent: eventName }, options);
    }
    // 그 외 모든 에러는 흘린다(앱에 영향 0).
  }
}

/**
 * 커스텀 이벤트를 전송한다. **호출 시 await/then/catch/finally 금지** — `void trackEvent(...)`.
 * 기본은 동의(ACCEPTED) 시에만 전송. requireConsent=false는 철회 사실 전송 등 특수 경우 한정.
 */
export function trackEvent(
  eventName: string,
  properties: TelemetryProperties = {},
  options: TelemetryOptions = {},
): void {
  void send(TrackType.EVENT, eventName, properties, options);
}

/**
 * 에러를 전송한다. **호출 시 await/then/catch/finally 금지** — `void trackError(...)`.
 * Rybbit "오류" 대시보드가 props.message / props.stack을 추출하므로 그 키로 담는다.
 * message·stack은 홈 경로를 '~'로 치환해 개인정보(경로 username 등)를 제거한다.
 */
export function trackError(
  error: Error,
  context: TelemetryProperties = {},
  options: TelemetryOptions = {},
): void {
  const props: TelemetryProperties = { message: sanitizeText(error.message || ''), ...context };
  if (error.stack) {
    props.stack = sanitizeText(error.stack);
  }
  void send(TrackType.ERROR, error.name || 'Error', props, options);
}
