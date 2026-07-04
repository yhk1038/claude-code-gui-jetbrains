import { describe, it, expect } from 'vitest';
import { parseUsageReport } from '../parseUsageReport';

// Real `claude -p "/usage"` output (from the terminal), verbatim.
const SAMPLE = `You are currently using your subscription to power your Claude Code usage

Current session: 11% used · resets Jul 4 at 5:30pm (Asia/Seoul)
Current week (all models): 8% used · resets Jul 11 at 1am (Asia/Seoul)

What's contributing to your limits usage?
Approximate, based on local sessions on this machine — does not include other devices or claude.ai. Behaviors are independent characteristics, not a breakdown.

Last 24h · 605 requests · 8 sessions
  97% of your usage came from subagent-heavy sessions
  66% of your usage was at >150k context
  Top skills: /worktree 4%, /code-review 2%
  Top subagents: general-purpose 16%, Explore 1%, code-review 1%
  Top plugins: oh-my-claudecode 1%
  Top MCP servers: claude.ai Notion 19%, playwright 1%

Last 7d · 9265 requests · 115 sessions
  83% of your usage came from subagent-heavy sessions
  59% of your usage was at >150k context
  16% of your usage came from sessions active for 8+ hours
  Top skills: /precheck 1%, /worktree 1%, /deploy 1%
  Top subagents: oh-my-claudecode:executor-high 4%, general-purpose 3%
  Top plugins: oh-my-claudecode 8%
  Top MCP servers: playwright 10%, claude.ai Notion 2%`;

describe('parseUsageReport', () => {
  it('extracts both periods with request/session counts', () => {
    const { periods } = parseUsageReport(SAMPLE);
    expect(periods.map((p) => p.label)).toEqual(['Last 24h', 'Last 7d']);
    expect(periods[0]).toMatchObject({ requests: 605, sessions: 8 });
    expect(periods[1]).toMatchObject({ requests: 9265, sessions: 115 });
  });

  it('collects insight lines under each period', () => {
    const { periods } = parseUsageReport(SAMPLE);
    expect(periods[0].insights).toContain('97% of your usage came from subagent-heavy sessions');
    expect(periods[0].insights).toContain('66% of your usage was at >150k context');
    expect(periods[1].insights).toContain('16% of your usage came from sessions active for 8+ hours');
    // "Top …" lines are breakdowns, not insights.
    expect(periods[0].insights.some((i) => i.startsWith('Top '))).toBe(false);
  });

  it('parses "Top …" breakdowns, including names with spaces and dots', () => {
    const { periods } = parseUsageReport(SAMPLE);
    const skills = periods[0].breakdowns.find((b) => b.title === 'Top skills');
    expect(skills?.items).toEqual([
      { name: '/worktree', percent: 4 },
      { name: '/code-review', percent: 2 },
    ]);
    const mcp = periods[0].breakdowns.find((b) => b.title === 'Top MCP servers');
    expect(mcp?.items).toEqual([
      { name: 'claude.ai Notion', percent: 19 },
      { name: 'playwright', percent: 1 },
    ]);
    const subagents = periods[1].breakdowns.find((b) => b.title === 'Top subagents');
    expect(subagents?.items[0]).toEqual({ name: 'oh-my-claudecode:executor-high', percent: 4 });
  });

  it('ignores the pre-period summary (session/week lines already shown via ccb)', () => {
    const { periods } = parseUsageReport(SAMPLE);
    // Nothing from before "Last 24h" should leak into a period.
    expect(periods[0].insights.some((i) => i.startsWith('Current session'))).toBe(false);
  });

  it('keeps the raw text and degrades gracefully on unrecognised input', () => {
    const { periods, raw } = parseUsageReport('totally unexpected output');
    expect(periods).toEqual([]);
    expect(raw).toBe('totally unexpected output');
  });
});
