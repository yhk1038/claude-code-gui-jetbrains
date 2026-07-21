/**
 * Parser for the raw text emitted by `claude -p "/usage"`.
 *
 * The backend returns that stdout unchanged (original-data preservation); this
 * turns it into a structure the modal can render. The CLI text looks like:
 *
 *   What's contributing to your limits usage?
 *   ...
 *   Last 24h · 605 requests · 8 sessions
 *     97% of your usage came from subagent-heavy sessions
 *     66% of your usage was at >150k context
 *     Top skills: /worktree 4%, /code-review 2%
 *     Top subagents: general-purpose 16%, Explore 1%
 *     ...
 *   Last 7d · 9265 requests · 115 sessions
 *     ...
 *
 * Parsing is best-effort and forgiving: `raw` is always kept so the UI can fall
 * back to the plain text if the CLI output format shifts.
 */

export interface UsageBreakdownItem {
  name: string;
  percent: number;
}

export interface UsageBreakdown {
  /** e.g. "Top skills", "Top subagents", "Top plugins", "Top MCP servers". */
  title: string;
  items: UsageBreakdownItem[];
}

export interface UsagePeriod {
  /** e.g. "Last 24h", "Last 7d". */
  label: string;
  requests: number | null;
  sessions: number | null;
  /** Free-text insight lines, e.g. "97% of your usage came from subagent-heavy sessions". */
  insights: string[];
  breakdowns: UsageBreakdown[];
}

export interface UsageReport {
  periods: UsagePeriod[];
  /** The original CLI text, kept for fallback rendering. */
  raw: string;
}

// "Last 24h · 605 requests · 8 sessions" — the middle dot is U+00B7. The nouns
// are singular for a count of 1 ("1 request", "1 session"), so `requests?` /
// `sessions?` accept both; without this, a user with a single session parses to
// zero periods and the whole breakdown shows "No usage breakdown available".
const PERIOD_RE = /^Last\s+(.+?)\s+·\s+([\d,]+)\s+requests?\s+·\s+([\d,]+)\s+sessions?/;
// "Top skills: /worktree 4%, /code-review 2%"
const TOP_RE = /^Top\s+(.+?):\s*(.+)$/;
// "general-purpose 16%" — name may contain spaces (e.g. "claude.ai Notion"),
// so match the trailing "<int>%" and take everything before it as the name.
const ITEM_RE = /^(.*\S)\s+(\d+)%$/;

function toNumber(raw: string): number | null {
  const n = parseInt(raw.replace(/,/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

function parseBreakdownItems(list: string): UsageBreakdownItem[] {
  const items: UsageBreakdownItem[] = [];
  for (const part of list.split(',')) {
    const m = part.trim().match(ITEM_RE);
    if (m) items.push({ name: m[1].trim(), percent: Number(m[2]) });
  }
  return items;
}

export function parseUsageReport(raw: string): UsageReport {
  const periods: UsagePeriod[] = [];
  let current: UsagePeriod | null = null;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const periodMatch = trimmed.match(PERIOD_RE);
    if (periodMatch) {
      current = {
        label: `Last ${periodMatch[1]}`,
        requests: toNumber(periodMatch[2]),
        sessions: toNumber(periodMatch[3]),
        insights: [],
        breakdowns: [],
      };
      periods.push(current);
      continue;
    }

    // Lines before the first period (heading, "Current session/week …") are the
    // ccb-covered summary; the modal already shows those, so skip them here.
    if (!current) continue;

    const topMatch = trimmed.match(TOP_RE);
    if (topMatch) {
      const items = parseBreakdownItems(topMatch[2]);
      if (items.length > 0) current.breakdowns.push({ title: `Top ${topMatch[1]}`, items });
      continue;
    }

    current.insights.push(trimmed);
  }

  return { periods, raw };
}
