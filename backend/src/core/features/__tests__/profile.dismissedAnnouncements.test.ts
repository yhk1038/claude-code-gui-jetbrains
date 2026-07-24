import { describe, it, expect } from 'vitest';
import { normalizeDismissedAnnouncementIds } from '../profile';

// The dismissed-announcement id list comes from a user-editable, possibly-corrupt
// profile.json, so it is normalized on read. These tests cover that pure guard.
describe('normalizeDismissedAnnouncementIds', () => {
  it('returns an empty array for a non-array value', () => {
    expect(normalizeDismissedAnnouncementIds(undefined)).toEqual([]);
    expect(normalizeDismissedAnnouncementIds(null)).toEqual([]);
    expect(normalizeDismissedAnnouncementIds('a1')).toEqual([]);
    expect(normalizeDismissedAnnouncementIds({ 0: 'a1' })).toEqual([]);
  });

  it('keeps string ids and drops non-string elements', () => {
    expect(normalizeDismissedAnnouncementIds(['a1', 2, null, 'a2', { id: 'a3' }, 'a4'])).toEqual([
      'a1',
      'a2',
      'a4',
    ]);
  });

  it('preserves an already-clean list of ids in order', () => {
    expect(normalizeDismissedAnnouncementIds(['x', 'y', 'z'])).toEqual(['x', 'y', 'z']);
  });

  it('returns an empty array for an empty array', () => {
    expect(normalizeDismissedAnnouncementIds([])).toEqual([]);
  });
});
