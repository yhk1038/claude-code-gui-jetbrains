import { describe, it, expect } from 'vitest';
import {
  isEligible,
  satisfiesVersionRange,
  selectForPlacement,
  visibleAnnouncementActions,
} from '../announcementEligibility';
import {
  AnnouncementActionType,
  AnnouncementFrequency,
  AnnouncementPlacement,
  type Announcement,
} from '@/shared';

const NOW = new Date('2026-07-24T00:00:00.000Z');

function makeAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'a1',
    placements: [AnnouncementPlacement.TOP_BANNER],
    priority: 0,
    icon: 'sparkles',
    title: 'Title',
    body: 'Body',
    dismissible: true,
    actions: [],
    target: { frequency: AnnouncementFrequency.UNTIL_DISMISSED },
    ...overrides,
  };
}

describe('satisfiesVersionRange', () => {
  it('passes when range is undefined or blank', () => {
    expect(satisfiesVersionRange('0.20.0', undefined)).toBe(true);
    expect(satisfiesVersionRange('0.20.0', '')).toBe(true);
    expect(satisfiesVersionRange('0.20.0', '   ')).toBe(true);
  });

  it('evaluates a single >= clause', () => {
    expect(satisfiesVersionRange('0.19.0', '>=0.19.0')).toBe(true);
    expect(satisfiesVersionRange('0.19.1', '>=0.19.0')).toBe(true);
    expect(satisfiesVersionRange('0.18.9', '>=0.19.0')).toBe(false);
  });

  it('evaluates a single > clause', () => {
    expect(satisfiesVersionRange('0.19.0', '>0.19.0')).toBe(false);
    expect(satisfiesVersionRange('0.19.1', '>0.19.0')).toBe(true);
  });

  it('evaluates <= and < clauses', () => {
    expect(satisfiesVersionRange('0.26.0', '<=0.26.0')).toBe(true);
    expect(satisfiesVersionRange('0.26.1', '<=0.26.0')).toBe(false);
    expect(satisfiesVersionRange('0.26.0', '<0.26.0')).toBe(false);
    expect(satisfiesVersionRange('0.25.9', '<0.26.0')).toBe(true);
  });

  it('evaluates an exact match with a bare version', () => {
    expect(satisfiesVersionRange('0.20.1', '0.20.1')).toBe(true);
    expect(satisfiesVersionRange('0.20.2', '0.20.1')).toBe(false);
  });

  it('ANDs space-separated clauses', () => {
    const range = '>=0.19.0 <0.26.0';
    expect(satisfiesVersionRange('0.19.0', range)).toBe(true);
    expect(satisfiesVersionRange('0.25.9', range)).toBe(true);
    expect(satisfiesVersionRange('0.26.0', range)).toBe(false);
    expect(satisfiesVersionRange('0.18.0', range)).toBe(false);
  });
});

describe('isEligible', () => {
  const ctx = { now: NOW, pluginVersion: '0.25.0', dismissedIds: [] as string[] };

  it('passes when showFrom/showUntil are unset', () => {
    expect(isEligible(makeAnnouncement(), ctx)).toBe(true);
  });

  it('date boundary: before showFrom is ineligible', () => {
    const a = makeAnnouncement({ target: { frequency: AnnouncementFrequency.ALWAYS, showFrom: '2026-08-01T00:00:00.000Z' } });
    expect(isEligible(a, ctx)).toBe(false);
  });

  it('date boundary: after showUntil is ineligible', () => {
    const a = makeAnnouncement({ target: { frequency: AnnouncementFrequency.ALWAYS, showUntil: '2026-07-01T00:00:00.000Z' } });
    expect(isEligible(a, ctx)).toBe(false);
  });

  it('date boundary: within the showFrom/showUntil window is eligible', () => {
    const a = makeAnnouncement({
      target: {
        frequency: AnnouncementFrequency.ALWAYS,
        showFrom: '2026-07-01T00:00:00.000Z',
        showUntil: '2026-08-01T00:00:00.000Z',
      },
    });
    expect(isEligible(a, ctx)).toBe(true);
  });

  it('date boundary: exactly at showFrom/showUntil is eligible (inclusive)', () => {
    const a = makeAnnouncement({
      target: {
        frequency: AnnouncementFrequency.ALWAYS,
        showFrom: NOW.toISOString(),
        showUntil: NOW.toISOString(),
      },
    });
    expect(isEligible(a, ctx)).toBe(true);
  });

  it('pluginVersion: satisfied range is eligible, unsatisfied is not', () => {
    const satisfied = makeAnnouncement({ target: { frequency: AnnouncementFrequency.ALWAYS, pluginVersion: '>=0.20.0' } });
    const unsatisfied = makeAnnouncement({ target: { frequency: AnnouncementFrequency.ALWAYS, pluginVersion: '>=0.30.0' } });
    expect(isEligible(satisfied, ctx)).toBe(true);
    expect(isEligible(unsatisfied, ctx)).toBe(false);
  });

  it('pluginVersion: unset range is eligible', () => {
    const a = makeAnnouncement({ target: { frequency: AnnouncementFrequency.ALWAYS } });
    expect(isEligible(a, ctx)).toBe(true);
  });

  it('frequency ONCE: excluded once dismissed', () => {
    const a = makeAnnouncement({ id: 'once-1', target: { frequency: AnnouncementFrequency.ONCE } });
    expect(isEligible(a, { ...ctx, dismissedIds: [] })).toBe(true);
    expect(isEligible(a, { ...ctx, dismissedIds: ['once-1'] })).toBe(false);
  });

  it('frequency UNTIL_DISMISSED: excluded once dismissed', () => {
    const a = makeAnnouncement({ id: 'ud-1', target: { frequency: AnnouncementFrequency.UNTIL_DISMISSED } });
    expect(isEligible(a, { ...ctx, dismissedIds: [] })).toBe(true);
    expect(isEligible(a, { ...ctx, dismissedIds: ['ud-1'] })).toBe(false);
  });

  it('frequency ALWAYS: stays eligible even when dismissed', () => {
    const a = makeAnnouncement({ id: 'always-1', target: { frequency: AnnouncementFrequency.ALWAYS } });
    expect(isEligible(a, { ...ctx, dismissedIds: ['always-1'] })).toBe(true);
  });
});

describe('selectForPlacement', () => {
  const ctx = { now: NOW, pluginVersion: '0.25.0', dismissedIds: [] as string[] };

  it('filters out announcements not targeting the placement', () => {
    const inBanner = makeAnnouncement({ id: 'banner', placements: [AnnouncementPlacement.TOP_BANNER] });
    const inModal = makeAnnouncement({ id: 'modal', placements: [AnnouncementPlacement.MODAL] });
    const result = selectForPlacement([inBanner, inModal], AnnouncementPlacement.TOP_BANNER, ctx);
    expect(result.map((a) => a.id)).toEqual(['banner']);
  });

  it('filters out ineligible announcements even if the placement matches', () => {
    const eligible = makeAnnouncement({ id: 'eligible' });
    const dismissed = makeAnnouncement({ id: 'dismissed' });
    const result = selectForPlacement([eligible, dismissed], AnnouncementPlacement.TOP_BANNER, {
      ...ctx,
      dismissedIds: ['dismissed'],
    });
    expect(result.map((a) => a.id)).toEqual(['eligible']);
  });

  it('sorts eligible announcements by priority descending', () => {
    const low = makeAnnouncement({ id: 'low', priority: 1 });
    const high = makeAnnouncement({ id: 'high', priority: 10 });
    const mid = makeAnnouncement({ id: 'mid', priority: 5 });
    const result = selectForPlacement([low, high, mid], AnnouncementPlacement.TOP_BANNER, ctx);
    expect(result.map((a) => a.id)).toEqual(['high', 'mid', 'low']);
  });

  it('does not mutate or rebuild the original entries (reference preserved)', () => {
    const a = makeAnnouncement({ id: 'ref-check' });
    const list = [a];
    const result = selectForPlacement(list, AnnouncementPlacement.TOP_BANNER, ctx);
    expect(result[0]).toBe(a);
    expect(list[0]).toBe(a);
  });
});

describe('visibleAnnouncementActions', () => {
  const dismissAction = { id: 'later', label: 'Later', type: AnnouncementActionType.DISMISS };
  const navAction = { id: 'go', label: 'Go', type: AnnouncementActionType.NAVIGATE, route: '/x' };

  it('keeps every action for a non-ALWAYS notice', () => {
    const a = makeAnnouncement({
      actions: [dismissAction, navAction],
      target: { frequency: AnnouncementFrequency.UNTIL_DISMISSED },
    });
    expect(visibleAnnouncementActions(a)).toHaveLength(2);
  });

  it('drops DISMISS-type actions for an ALWAYS notice (it can never be dismissed)', () => {
    const a = makeAnnouncement({
      actions: [dismissAction, navAction],
      target: { frequency: AnnouncementFrequency.ALWAYS },
    });
    const result = visibleAnnouncementActions(a);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(AnnouncementActionType.NAVIGATE);
  });
});
