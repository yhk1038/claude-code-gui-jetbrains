import { compareVersions } from '../utils/compareVersions';
import { AnnouncementFrequency, type Announcement, type AnnouncementPlacement } from '@/shared';

/** Runtime inputs needed to decide whether an announcement is currently eligible. */
export interface AnnouncementEligibilityContext {
  now: Date;
  pluginVersion: string;
  /**
   * Permanently-recorded dismissals (from profile.json). Used for ONCE (recorded
   * the moment it's shown) and UNTIL_DISMISSED (recorded when the user closes it).
   * ALWAYS-frequency announcements ignore this list.
   */
  dismissedIds: string[];
  /**
   * Volatile, per-view-instance dismissals held only in the `useAnnouncements`
   * hook state. Every frequency (including ALWAYS) respects this — it hides an
   * announcement in the current view without persisting. When the slot remounts
   * (a new query instance), this resets and an ALWAYS announcement shows again.
   */
  locallyDismissedIds: string[];
}

type RangeOperator = '>=' | '<=' | '>' | '<' | '=';

interface RangeClause {
  operator: RangeOperator;
  version: string;
}

// Longest-prefix-first so '>=' isn't matched by '>' before its second char is checked.
const OPERATORS: RangeOperator[] = ['>=', '<=', '>', '<', '='];

function parseClause(token: string): RangeClause | null {
  for (const operator of OPERATORS) {
    if (token.startsWith(operator)) {
      const version = token.slice(operator.length).trim();
      return version ? { operator, version } : null;
    }
  }
  const version = token.trim();
  return version ? { operator: '=', version } : null;
}

function satisfiesClause(version: string, clause: RangeClause): boolean {
  const cmp = compareVersions(version, clause.version);
  switch (clause.operator) {
    case '>=':
      return cmp >= 0;
    case '<=':
      return cmp <= 0;
    case '>':
      return cmp > 0;
    case '<':
      return cmp < 0;
    case '=':
      return cmp === 0;
  }
}

/**
 * Evaluates a small, space-separated AND-of-comparisons version range
 * (e.g. `">=0.19.0"`, `">=0.19.0 <0.26.0"`, or a bare `"0.20.1"` for an exact
 * match) against `version`. This is NOT a full semver implementation — it's a
 * deliberately minimal dotted-numeric comparator built on
 * `utils/compareVersions.ts`, to avoid adding an external semver dependency
 * (this project minimizes dependencies). An empty/unparseable range means
 * "no constraint" and passes.
 */
export function satisfiesVersionRange(version: string, range: string | undefined): boolean {
  if (!range || !range.trim()) return true;
  const clauses = range
    .trim()
    .split(/\s+/)
    .map(parseClause)
    .filter((c): c is RangeClause => c !== null);
  if (clauses.length === 0) return true;
  return clauses.every((clause) => satisfiesClause(version, clause));
}

/**
 * Whether `announcement` is currently eligible to render, given `ctx`:
 * - date window: `showFrom` ≤ now ≤ `showUntil` (either bound optional)
 * - pluginVersion: current version must satisfy `target.pluginVersion` range (optional)
 * - permanent dismissal: `ONCE`/`UNTIL_DISMISSED` are excluded once in `dismissedIds`;
 *   `ALWAYS` ignores `dismissedIds` (never persisted)
 * - local dismissal: any frequency (including `ALWAYS`) is excluded while in
 *   `locallyDismissedIds` — this is how a closed ALWAYS announcement stays hidden
 *   for the current view yet reappears after a remount
 */
export function isEligible(announcement: Announcement, ctx: AnnouncementEligibilityContext): boolean {
  const { target } = announcement;

  if (target.showFrom && ctx.now < new Date(target.showFrom)) return false;
  if (target.showUntil && ctx.now > new Date(target.showUntil)) return false;
  if (!satisfiesVersionRange(ctx.pluginVersion, target.pluginVersion)) return false;

  if (target.frequency !== AnnouncementFrequency.ALWAYS && ctx.dismissedIds.includes(announcement.id)) {
    return false;
  }

  if (ctx.locallyDismissedIds.includes(announcement.id)) return false;

  return true;
}

/**
 * Filters `announcements` down to the ones allowed in `placement` and currently
 * eligible (see `isEligible`), sorted by `priority` descending (higher shows
 * first). Only filters/sorts the array — individual entries are returned by
 * reference, never rebuilt or edited (원본 데이터 보존 원칙).
 */
export function selectForPlacement(
  announcements: Announcement[],
  placement: AnnouncementPlacement,
  ctx: AnnouncementEligibilityContext,
): Announcement[] {
  return announcements
    .filter((announcement) => announcement.placements.includes(placement) && isEligible(announcement, ctx))
    .sort((a, b) => b.priority - a.priority);
}
