import { announcementsUrl } from '../../config/environment';
import { readMergedClaudeSettings } from './claude-settings';
import { getPluginVersion } from '../handlers/getVersion';
import { getAnnouncementsEnabled } from './profile';
import {
  AnnouncementActionType,
  AnnouncementFrequency,
  AnnouncementPlacement,
  type Announcement,
  type AnnouncementAction,
  type AnnouncementTarget,
  type AnnouncementsResponse,
} from '../../shared';

// ─── SDUI Announcements fetch ────────────────────────────────────────────────
// Fetches the remote announcements delivery payload (see shared/announcement.ts)
// with the same "never let this break the app" posture as telemetry.ts: any
// network/parsing failure is swallowed and a graceful empty list is returned.
// Unlike telemetry, this is NOT gated by consent (no PII is ever sent — only
// locale + pluginVersion) and callers MAY await it (it drives UI content).

/** The schema version this client understands. A server response with a different
 * `schemaVersion` is treated as "not yet compatible" and skipped gracefully. */
const SCHEMA_VERSION = 1;

/** In-memory cache TTL — avoids re-fetching on every GET_ANNOUNCEMENTS call
 * (e.g. repeated tab opens) within a short window. */
const CACHE_TTL_MS = 5 * 60 * 1000;

// Mirrors webview/src/i18n/languageMap.ts's LANGUAGE_TO_LOCALE map. The backend
// and webview are separate pnpm workspaces (no cross-package imports), so this
// small map is intentionally duplicated here — keep the two in sync manually if
// a new interface language is ever added to LANGUAGE_OPTIONS in
// webview/src/pages/SettingsPage/General/index.tsx.
const LANGUAGE_TO_LOCALE: Record<string, string> = {
  english: 'en',
  korean: 'ko',
  japanese: 'ja',
  chinese: 'zh',
  'chinese-traditional': 'zh-TW',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  portuguese: 'pt',
  russian: 'ru',
  persian: 'fa',
  arabic: 'ar',
};
const DEFAULT_LOCALE = 'en';

/** Resolves the stored "Interface Language" Claude setting (`uiLanguage`) to a BCP-47 locale. */
function resolveLocale(uiLanguage: unknown): string {
  return typeof uiLanguage === 'string' && uiLanguage in LANGUAGE_TO_LOCALE
    ? LANGUAGE_TO_LOCALE[uiLanguage]
    : DEFAULT_LOCALE;
}

function isEnumValue<T extends string>(enumObj: Record<string, T>, value: unknown): value is T {
  return typeof value === 'string' && (Object.values(enumObj) as string[]).includes(value);
}

function isValidAction(value: unknown): value is AnnouncementAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as Record<string, unknown>;
  if (typeof action.id !== 'string' || typeof action.label !== 'string') return false;
  if (!isEnumValue(AnnouncementActionType, action.type)) return false;
  if (action.url !== undefined && typeof action.url !== 'string') return false;
  if (action.route !== undefined && typeof action.route !== 'string') return false;
  if (action.command !== undefined && typeof action.command !== 'string') return false;
  return true;
}

function isValidTarget(value: unknown): value is AnnouncementTarget {
  if (!value || typeof value !== 'object') return false;
  const target = value as Record<string, unknown>;
  if (!isEnumValue(AnnouncementFrequency, target.frequency)) return false;
  if (target.pluginVersion !== undefined && typeof target.pluginVersion !== 'string') return false;
  if (target.showFrom !== undefined && typeof target.showFrom !== 'string') return false;
  if (target.showUntil !== undefined && typeof target.showUntil !== 'string') return false;
  return true;
}

/**
 * Validates that `value` matches the `Announcement` shape (required fields present,
 * correct primitive types, enum members are known). Passing items are returned
 * as-is (same object reference) — per the "원본 데이터 보존" principle we never
 * rebuild/rename fields, only filter out invalid entries.
 */
function isValidAnnouncement(value: unknown): value is Announcement {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string') return false;
  if (!Array.isArray(item.placements) || item.placements.length === 0) return false;
  if (!item.placements.every((p) => isEnumValue(AnnouncementPlacement, p))) return false;
  if (typeof item.priority !== 'number') return false;
  if (typeof item.icon !== 'string') return false;
  if (item.imageUrl !== undefined && typeof item.imageUrl !== 'string') return false;
  if (typeof item.title !== 'string') return false;
  if (typeof item.body !== 'string') return false;
  if (typeof item.dismissible !== 'boolean') return false;
  if (!Array.isArray(item.actions) || !item.actions.every(isValidAction)) return false;
  if (!isValidTarget(item.target)) return false;
  return true;
}

const EMPTY_RESPONSE: AnnouncementsResponse = { schemaVersion: SCHEMA_VERSION, announcements: [] };

/**
 * Validates the raw fetch response body against the announcements contract.
 * Any mismatch (unknown schemaVersion, malformed envelope, invalid entries)
 * degrades gracefully to an empty list rather than throwing.
 */
export function validateResponse(data: unknown): AnnouncementsResponse {
  if (!data || typeof data !== 'object') return EMPTY_RESPONSE;
  const body = data as Record<string, unknown>;
  if (body.schemaVersion !== SCHEMA_VERSION) return EMPTY_RESPONSE;
  if (!Array.isArray(body.announcements)) return EMPTY_RESPONSE;
  return {
    schemaVersion: SCHEMA_VERSION,
    announcements: body.announcements.filter(isValidAnnouncement),
  };
}

interface CacheEntry {
  expiresAt: number;
  response: AnnouncementsResponse;
}
const cache = new Map<string, CacheEntry>();

/**
 * Fetches the current locale's announcement list from the remote delivery endpoint
 * (`CCG_ANNOUNCE_URL`), short-TTL cached per locale+pluginVersion. Returns an empty
 * list (never throws) when the user turned announcements off (profile.json
 * `announcementsEnabled`), the URL is unset, the request fails, or the response
 * doesn't validate. The request carries ONLY `locale` and `pluginVersion` — no
 * install id / uuid / any other PII (this is content delivery, not telemetry).
 */
export async function fetchAnnouncements(workingDir?: string): Promise<AnnouncementsResponse> {
  // 마켓 "비활성 시 전송 금지" 준수: 사용자가 공지 수신을 껐으면 원격 fetch 자체를 하지
  // 않는다(URL 미설정 체크와 같은 위치의 early-return).
  if (!(await getAnnouncementsEnabled())) return EMPTY_RESPONSE;
  if (!announcementsUrl) return EMPTY_RESPONSE;

  // Enforce https on the delivery endpoint: a plain-http URL would let a MITM
  // rewrite announcement content. Reject (graceful empty) rather than fetch over
  // an untrusted channel. Malformed URLs are rejected here too.
  let baseUrl: URL;
  try {
    baseUrl = new URL(announcementsUrl);
  } catch {
    console.error('[node-backend]', 'Invalid CCG_ANNOUNCE_URL, ignoring:', announcementsUrl);
    return EMPTY_RESPONSE;
  }
  // https is required in general (a plain-http endpoint would let a MITM rewrite
  // content), but http://localhost is allowed for local development/testing since
  // loopback traffic can't be intercepted on the network.
  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname);
  if (baseUrl.protocol !== 'https:' && !(baseUrl.protocol === 'http:' && isLoopback)) {
    console.error('[node-backend]', 'CCG_ANNOUNCE_URL must use https, ignoring:', baseUrl.protocol);
    return EMPTY_RESPONSE;
  }

  const { settings } = await readMergedClaudeSettings(workingDir);
  const locale = resolveLocale(settings.uiLanguage);
  const pluginVersion = getPluginVersion();

  const cacheKey = `${locale}::${pluginVersion}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.response;

  try {
    const url = new URL(baseUrl.toString());
    url.searchParams.set('locale', locale);
    url.searchParams.set('pluginVersion', pluginVersion);

    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) {
      console.error('[node-backend]', `Failed to fetch announcements: HTTP ${res.status}`);
      return EMPTY_RESPONSE;
    }

    const data: unknown = await res.json();
    const response = validateResponse(data);
    cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, response });
    return response;
  } catch (err) {
    console.error('[node-backend]', 'Failed to fetch announcements:', err);
    return EMPTY_RESPONSE;
  }
}
