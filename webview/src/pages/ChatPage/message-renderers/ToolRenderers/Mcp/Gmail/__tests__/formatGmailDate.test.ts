import {describe, it, expect} from 'vitest';
import {formatGmailDate} from '../_shared/helpers';

// Fixed reference point: 2026-06-24 10:00:00 local time
const NOW = new Date('2026-06-24T10:00:00');

// Pin the formatting locale so month/day rendering does not depend on the
// host's system locale (issue #193 — Polish "gru"/"sty" broke /Dec|Jan/).
const LOCALE = 'en-US';

describe('formatGmailDate', () => {
    describe('fallback cases', () => {
        it('returns empty string when value is undefined', () => {
            expect(formatGmailDate(undefined, NOW)).toBe('');
        });

        it('returns empty string when value is empty string', () => {
            expect(formatGmailDate('', NOW)).toBe('');
        });

        it('returns the original string when it cannot be parsed as a date', () => {
            const unparseable = 'not-a-date';
            expect(formatGmailDate(unparseable, NOW)).toBe(unparseable);
        });
    });

    describe('same day as now — shows time only (no year/month/day)', () => {
        it('omits year, month, and day for a mail sent today', () => {
            // Same year, month, day as NOW (2026-06-24)
            const todayMail = '2026-06-24T01:01:00';
            const result = formatGmailDate(todayMail, NOW, LOCALE);
            // Should NOT contain year
            expect(result).not.toMatch(/2026/);
            // Should NOT contain month indicator (e.g. '6월' or 'Jun')
            expect(result).not.toMatch(/6[월]|Jun/);
            // Should NOT contain day digit followed by 일 (e.g. '24일')
            expect(result).not.toMatch(/24[일]?\s*$/);
            // Should contain hour and minute digits
            expect(result).toMatch(/\d{1,2}:\d{2}/);
        });
    });

    describe('same month, different day — shows day + time (no year/month)', () => {
        it('omits year and month for a mail sent this month', () => {
            // Same year+month (2026-06), different day (9)
            const thisMonthMail = '2026-06-09T01:01:00';
            const result = formatGmailDate(thisMonthMail, NOW, LOCALE);
            // Should NOT contain year
            expect(result).not.toMatch(/2026/);
            // Should NOT contain month indicator
            expect(result).not.toMatch(/6[월]|Jun/i);
            // Should contain the day digit '9'
            expect(result).toMatch(/9/);
            // Should contain hour and minute
            expect(result).toMatch(/\d{1,2}:\d{2}/);
        });
    });

    describe('same year, different month — shows month + day + time (no year)', () => {
        it('omits year but includes month for a mail sent this year in a different month', () => {
            // Same year (2026), different month (January)
            const thisYearMail = '2026-01-15T08:30:00';
            const result = formatGmailDate(thisYearMail, NOW, LOCALE);
            // Should NOT contain year
            expect(result).not.toMatch(/2026/);
            // Should contain month indicator (1월 or Jan)
            expect(result).toMatch(/1[월]|Jan/i);
            // Should contain day
            expect(result).toMatch(/15/);
            // Should contain hour and minute
            expect(result).toMatch(/\d{1,2}:\d{2}/);
        });
    });

    describe('different year — shows full date including year', () => {
        it('includes year for a mail from a previous year', () => {
            const lastYearMail = '2025-12-25T09:00:00';
            const result = formatGmailDate(lastYearMail, NOW, LOCALE);
            // Should contain year
            expect(result).toMatch(/2025/);
            // Should contain month indicator
            expect(result).toMatch(/12[월]|Dec/i);
            // Should contain day
            expect(result).toMatch(/25/);
            // Should contain hour and minute
            expect(result).toMatch(/\d{1,2}:\d{2}/);
        });

        it('includes year for a mail from a future year', () => {
            const futureYearMail = '2027-03-10T14:00:00';
            const result = formatGmailDate(futureYearMail, NOW, LOCALE);
            expect(result).toMatch(/2027/);
        });
    });
});
