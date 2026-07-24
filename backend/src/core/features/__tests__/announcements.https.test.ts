import { describe, it, expect, vi, afterEach } from 'vitest';

// Separate file: pins announcementsUrl to a plain-http endpoint for the whole
// file to prove the https-only guard rejects it before any network request.
vi.mock('../../../config/environment', () => ({ announcementsUrl: 'http://insecure.example/api' }));
vi.mock('../claude-settings', () => ({ readMergedClaudeSettings: vi.fn() }));
vi.mock('../../handlers/getVersion', () => ({ getPluginVersion: vi.fn(() => '9.9.9') }));
vi.mock('../profile', () => ({ getAnnouncementsEnabled: vi.fn(() => Promise.resolve(true)) }));

import { fetchAnnouncements } from '../announcements';

describe('fetchAnnouncements with a non-https delivery URL', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty list and never fetches over plain http', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await fetchAnnouncements();

    expect(result.announcements).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
