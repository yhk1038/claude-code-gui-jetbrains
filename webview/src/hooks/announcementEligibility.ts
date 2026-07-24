import { compareVersions } from '../utils/compareVersions';
import {
  AnnouncementActionType,
  AnnouncementFrequency,
  type Announcement,
  type AnnouncementAction,
  type AnnouncementPlacement,
} from '@/shared';

/**
 * Actions to actually render for an announcement. An ALWAYS-frequency notice
 * can never be dismissed (its X is hidden too), so a DISMISS-type action would
 * be a dead button — filter it out. All other action types are kept.
 */
export function visibleAnnouncementActions(announcement: Announcement): AnnouncementAction[] {
  if (announcement.target.frequency !== AnnouncementFrequency.ALWAYS) return announcement.actions;
  return announcement.actions.filter((action) => action.type !== AnnouncementActionType.DISMISS);
}

/** Runtime inputs needed to decide whether an announcement is currently eligible. */
export interface AnnouncementEligibilityContext {
  now: Date;
  pluginVersion: string;
  dismissedIds: string[];
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
 * - frequency: `ONCE`/`UNTIL_DISMISSED` are excluded once dismissed; `ALWAYS` ignores dismissal
 */
export function isEligible(announcement: Announcement, ctx: AnnouncementEligibilityContext): boolean {
  const { target } = announcement;

  if (target.showFrom && ctx.now < new Date(target.showFrom)) return false;
  if (target.showUntil && ctx.now > new Date(target.showUntil)) return false;
  if (!satisfiesVersionRange(ctx.pluginVersion, target.pluginVersion)) return false;

  if (target.frequency !== AnnouncementFrequency.ALWAYS && ctx.dismissedIds.includes(announcement.id)) {
    return false;
  }

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
