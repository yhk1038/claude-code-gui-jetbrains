import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

// ─── User profile (global, telemetry-independent) ────────────────────────────
// `~/.claude-code-gui/profile.json` holds a per-install pseudonymous uuid and the
// telemetry consent decision. The uuid is created for EVERY user regardless of
// consent; nothing is transmitted unless consent status is GRANTED.

const PROFILE_DIR = join(homedir(), '.claude-code-gui');
const PROFILE_FILE = join(PROFILE_DIR, 'profile.json');

/** 텔레메트리 동의 상태. PENDING = 아직 수락/거절 중 무엇도 응답하지 않음. */
export enum ConsentStatus {
  PENDING = 'pending',
  GRANTED = 'granted',
  DENIED = 'denied',
}

export interface TelemetryConsent {
  status: ConsentStatus;
  /** 수락/거절을 결정한 시각(ISO 8601). 미응답이면 null. */
  decidedAt: string | null;
}

export interface ProfileData {
  /** 설치 단위 가명 식별자. 동의 여부와 무관하게 항상 존재한다. */
  uuid: string;
  telemetryConsent: TelemetryConsent;
}

function createDefaultProfile(): ProfileData {
  return {
    uuid: randomUUID(),
    telemetryConsent: { status: ConsentStatus.PENDING, decidedAt: null },
  };
}

/** 저장된 status가 알 수 없는 값이면 PENDING으로 보정한다. */
function normalizeStatus(status: ConsentStatus | undefined): ConsentStatus {
  return status === ConsentStatus.GRANTED || status === ConsentStatus.DENIED
    ? status
    : ConsentStatus.PENDING;
}

async function writeProfile(profile: ProfileData): Promise<void> {
  await mkdir(PROFILE_DIR, { recursive: true });
  await writeFile(PROFILE_FILE, JSON.stringify(profile, null, 2) + '\n', 'utf-8');
}

/**
 * profile.json을 읽어 반환한다. 파일이나 필드가 없거나 손상됐으면 보정해 다시 저장한다.
 * uuid는 동의 여부와 무관하게 항상 보장된다(없으면 생성). 서버 시작 시 1회 호출한다.
 */
export async function ensureProfile(): Promise<ProfileData> {
  if (!existsSync(PROFILE_FILE)) {
    const profile = createDefaultProfile();
    await writeProfile(profile);
    return profile;
  }

  try {
    const raw = await readFile(PROFILE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ProfileData>;

    const profile: ProfileData = {
      uuid:
        typeof parsed.uuid === 'string' && parsed.uuid.length > 0 ? parsed.uuid : randomUUID(),
      telemetryConsent: {
        status: normalizeStatus(parsed.telemetryConsent?.status),
        decidedAt: parsed.telemetryConsent?.decidedAt ?? null,
      },
    };

    // 누락/손상 필드를 보정했으면 파일을 다시 써서 정규화한다.
    const needsRewrite =
      parsed.uuid !== profile.uuid ||
      parsed.telemetryConsent?.status !== profile.telemetryConsent.status ||
      parsed.telemetryConsent?.decidedAt !== profile.telemetryConsent.decidedAt;
    if (needsRewrite) {
      await writeProfile(profile);
    }
    return profile;
  } catch {
    // JSON 파싱 실패 등 손상: 새 프로필로 복구한다(기존 uuid는 보존 불가).
    const profile = createDefaultProfile();
    await writeProfile(profile);
    return profile;
  }
}

/** 현재 프로필을 읽는다(없으면 생성). */
export async function readProfile(): Promise<ProfileData> {
  return ensureProfile();
}

/** 텔레메트리 동의/거절을 타임스탬프와 함께 기록한다. */
export async function setTelemetryConsent(granted: boolean): Promise<ProfileData> {
  const profile = await ensureProfile();
  profile.telemetryConsent = {
    status: granted ? ConsentStatus.GRANTED : ConsentStatus.DENIED,
    decidedAt: new Date().toISOString(),
  };
  await writeProfile(profile);
  return profile;
}
