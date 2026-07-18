/**
 * Safely parse a tool_result OUT string into a typed object.
 * Returns undefined when the text is empty or not valid JSON, so callers can
 * fall back to rendering the raw text. Never throws.
 */
export function safeParseJson<T>(text: string): T | undefined {
    if (!text) return undefined;
    try {
        return JSON.parse(text) as T;
    } catch {
        return undefined;
    }
}

/**
 * Format an ISO date string into a compact, human-readable label.
 * Cascades over shared upper units (year → month → day) compared to `now`
 * and omits any level that matches, so only the differing parts are shown.
 *
 * Examples (now = 2026-06-24):
 *   same day   → "오전 01:01"
 *   same month → "9일 오전 01:01"
 *   same year  → "6월 9일 오전 01:01"
 *   other year → "2026년 6월 9일 오전 01:01"
 *
 * Falls back to the original string when it is not a parseable date, so the
 * original Claude Code value is never lost. Never throws.
 *
 * `locale` defaults to `undefined`, i.e. the host locale — production keeps
 * following the user's environment. Tests pass an explicit BCP-47 locale so
 * their assertions do not depend on the machine's system locale (issue #193).
 */
export function formatGmailDate(value?: string, now: Date = new Date(), locale?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    const sameYear = date.getFullYear() === now.getFullYear();
    const sameMonth = sameYear && date.getMonth() === now.getMonth();
    const sameDay = sameMonth && date.getDate() === now.getDate();

    const opts: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
    };
    if (!sameDay) opts.day = 'numeric';
    if (!sameMonth) opts.month = 'short';
    if (!sameYear) opts.year = 'numeric';

    return date.toLocaleString(locale, opts);
}

/**
 * Gmail marks unread mail with an "UNREAD" entry in labelIds.
 */
export function isUnread(labelIds?: string[]): boolean {
    return Array.isArray(labelIds) && labelIds.includes('UNREAD');
}
