import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AnnouncementActionType,
  AnnouncementFrequency,
  AnnouncementPlacement,
} from '../../../shared';

// The remote delivery endpoint URL, the merged Claude settings (for locale), and
// the plugin version are all mocked so fetchAnnouncements can be exercised without
// real IO. Each mock is controllable per-test via vi.mocked(...).
vi.mock('../../../config/environment', () => ({ announcementsUrl: 'https://ann.example/api' }));
vi.mock('../claude-settings', () => ({ readMergedClaudeSettings: vi.fn() }));
vi.mock('../../handlers/getVersion', () => ({ getPluginVersion: vi.fn(() => '9.9.9') }));

import { validateResponse, fetchAnnouncements } from '../announcements';
import { readMergedClaudeSettings } from '../claude-settings';

/** A fully-valid raw announcement; override individual fields to test rejection. */
function rawAnnouncement(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'a1',
    placements: [AnnouncementPlacement.EMPTY_STATE],
    priority: 100,
    icon: 'bolt',
    title: 'Title',
    body: 'Body',
    dismissible: true,
    actions: [{ id: 'ok', label: 'OK', type: AnnouncementActionType.DISMISS }],
    target: { frequency: AnnouncementFrequency.UNTIL_DISMISSED },
    ...over,
  };
}

describe('validateResponse', () => {
  it('returns an empty list for a null / non-object body', () => {
    expect(validateResponse(null).announcements).toEqual([]);
    expect(validateResponse('nope').announcements).toEqual([]);
    expect(validateResponse(42).announcements).toEqual([]);
  });

  it('returns an empty list when schemaVersion is not the one this client understands', () => {
    const body = { schemaVersion: 2, announcements: [rawAnnouncement()] };
    expect(validateResponse(body).announcements).toEqual([]);
  });

  it('returns an empty list when announcements is not an array', () => {
    const body = { schemaVersion: 1, announcements: 'oops' };
    expect(validateResponse(body).announcements).toEqual([]);
  });

  it('keeps valid entries as-is (same object reference, no field editing)', () => {
    const entry = rawAnnouncement();
    const body = { schemaVersion: 1, announcements: [entry] };
    const result = validateResponse(body);
    expect(result.schemaVersion).toBe(1);
    expect(result.announcements).toHaveLength(1);
    // 원본 데이터 보존: the surviving entry must be the very same object, unedited.
    expect(result.announcements[0]).toBe(entry);
  });

  it('filters out entries with an unknown placement enum member', () => {
    const bad = rawAnnouncement({ placements: ['SIDEBAR'] });
    const good = rawAnnouncement({ id: 'a2' });
    const result = validateResponse({ schemaVersion: 1, announcements: [bad, good] });
    expect(result.announcements.map((a) => a.id)).toEqual(['a2']);
  });

  it('filters out entries missing a required field or with a wrong primitive type', () => {
    const noTitle = rawAnnouncement({ id: 'no-title', title: undefined });
    const numericBody = rawAnnouncement({ id: 'num-body', body: 123 });
    const emptyPlacements = rawAnnouncement({ id: 'empty', placements: [] });
    const result = validateResponse({
      schemaVersion: 1,
      announcements: [noTitle, numericBody, emptyPlacements],
    });
    expect(result.announcements).toEqual([]);
  });

  it('filters out entries whose action has an unknown action type', () => {
    const bad = rawAnnouncement({
      actions: [{ id: 'x', label: 'X', type: 'SELF_DESTRUCT' }],
    });
    const result = validateResponse({ schemaVersion: 1, announcements: [bad] });
    expect(result.announcements).toEqual([]);
  });
});

describe('fetchAnnouncements', () => {
  beforeEach(() => {
    vi.mocked(readMergedClaudeSettings).mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends ONLY locale + pluginVersion in the query — no install id / uuid / PII', async () => {
    // Unique locale (ko) keeps this call out of any other test's cache entry.
    vi.mocked(readMergedClaudeSettings).mockResolvedValue({
      settings: { uiLanguage: 'korean' },
      overrides: [],
    });
    const fetchSpy = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ schemaVersion: 1, announcements: [] }),
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await fetchAnnouncements();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = new URL(fetchSpy.mock.calls[0][0]);
    expect(calledUrl.searchParams.get('locale')).toBe('ko');
    expect(calledUrl.searchParams.get('pluginVersion')).toBe('9.9.9');
    // The query carries exactly these two keys — nothing that could identify a user.
    expect([...calledUrl.searchParams.keys()].sort()).toEqual(['locale', 'pluginVersion']);
  });

  it('degrades to an empty list (never throws) on a non-ok HTTP response', async () => {
    // Unique locale (en) → distinct cache key from the test above.
    vi.mocked(readMergedClaudeSettings).mockResolvedValue({
      settings: { uiLanguage: 'english' },
      overrides: [],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 503, json: async () => ({}) })),
    );

    const result = await fetchAnnouncements();
    expect(result.announcements).toEqual([]);
  });
});
