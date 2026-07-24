import { describe, it, expect, vi, afterEach } from 'vitest';

// A separate file because announcementsUrl is a module-level constant: here we
// pin it to `undefined` for the whole file to prove the "no URL configured" path.
vi.mock('../../../config/environment', () => ({ announcementsUrl: undefined }));
vi.mock('../claude-settings', () => ({ readMergedClaudeSettings: vi.fn() }));
vi.mock('../../handlers/getVersion', () => ({ getPluginVersion: vi.fn(() => '9.9.9') }));
vi.mock('../profile', () => ({ getAnnouncementsEnabled: vi.fn(() => Promise.resolve(true)) }));

import { fetchAnnouncements } from '../announcements';

describe('fetchAnnouncements with no delivery URL configured', () => {
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
