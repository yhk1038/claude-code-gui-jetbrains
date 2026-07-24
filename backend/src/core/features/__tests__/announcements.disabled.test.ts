import { describe, it, expect, vi, afterEach } from 'vitest';

// A separate file: pins announcementsEnabled to false for the whole file to prove
// the "user turned announcements off" gate short-circuits before the URL check /
// any network request — mirrors announcements.url-unset.test.ts's isolation style.
vi.mock('../../../config/environment', () => ({ announcementsUrl: 'https://ann.example/api' }));
vi.mock('../claude-settings', () => ({ readMergedClaudeSettings: vi.fn() }));
vi.mock('../../handlers/getVersion', () => ({ getPluginVersion: vi.fn(() => '9.9.9') }));
vi.mock('../profile', () => ({ getAnnouncementsEnabled: vi.fn(() => Promise.resolve(false)) }));

import { fetchAnnouncements } from '../announcements';

describe('fetchAnnouncements with announcementsEnabled=false', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty list and never performs a network request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchAnnouncements();

    expect(result.announcements).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
