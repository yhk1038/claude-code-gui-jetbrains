import { describe, it, expect } from 'vitest';
import { isOlderPagePrepend } from '../paging';

describe('isOlderPagePrepend', () => {
  it('treats an initial load (null -> value) as NOT a prepend', () => {
    // The first page moves the oldest from null to a real uuid; anchoring here
    // would fight the initial scroll-to-bottom.
    expect(isOlderPagePrepend(null, 'uuid-a')).toBe(false);
  });

  it('treats a streaming update (oldest unchanged) as NOT a prepend', () => {
    // A streaming delta grows the newest messages; oldestLoadedUuid stays put.
    // This is the case that previously slipped through and jumped the viewport.
    expect(isOlderPagePrepend('uuid-a', 'uuid-a')).toBe(false);
  });

  it('treats an older-page load (oldest changes to a new non-null value) as a prepend', () => {
    // loadOlder prepended a page: the oldest loaded message moved back.
    expect(isOlderPagePrepend('uuid-a', 'uuid-older')).toBe(true);
  });

  it('is NOT a prepend when both are null (empty/uninitialized session)', () => {
    expect(isOlderPagePrepend(null, null)).toBe(false);
  });

  it('treats oldest becoming null again as a prepend edge (value -> null)', () => {
    // Defensive: a non-null previous oldest changing to null still differs, so it
    // is reported as a prepend rather than a streaming no-op.
    expect(isOlderPagePrepend('uuid-a', null)).toBe(true);
  });
});
