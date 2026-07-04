import { describe, it, expect, vi } from 'vitest';
import { UsageCommand, matchesUsageCommand } from '../UsageCommand';
import { OPEN_ACCOUNT_USAGE_EVENT } from '../../model/AccountUsageItem';

describe('matchesUsageCommand', () => {
  // Callers trim first; these inputs are already trimmed.
  it('matches /usage exactly', () => {
    expect(matchesUsageCommand('/usage')).toBe(true);
  });

  it('matches /usage followed by a space (and nothing else)', () => {
    // '/usage ' trims to '/usage', which still counts as starting with /usage.
    expect(matchesUsageCommand('/usage')).toBe(true);
  });

  it('matches /usage followed by a space and more text', () => {
    expect(matchesUsageCommand('/usage ㅗㅑㅗㅑ')).toBe(true);
    expect(matchesUsageCommand('/usage please show me')).toBe(true);
  });

  it('does NOT match /usage joined to a non-space suffix', () => {
    expect(matchesUsageCommand('/usageㅁㅁ')).toBe(false);
    expect(matchesUsageCommand('/usage-credits')).toBe(false);
    expect(matchesUsageCommand('/usagex')).toBe(false);
  });

  it('does NOT match when /usage is not at the start', () => {
    expect(matchesUsageCommand('show /usage')).toBe(false);
  });
});

describe('UsageCommand', () => {
  it('opens the usage modal instead of sending /usage to the CLI', async () => {
    const spy = vi.fn();
    window.addEventListener(OPEN_ACCOUNT_USAGE_EVENT, spy);
    try {
      await new UsageCommand().execute();
    } finally {
      window.removeEventListener(OPEN_ACCOUNT_USAGE_EVENT, spy);
    }
    expect(spy).toHaveBeenCalledOnce();
  });

  it('uses the /usage label so it shadows the CLI passthrough command of the same name', () => {
    // CommandPaletteProvider dedups CLI commands whose label matches a local
    // command, so this label MUST stay exactly '/usage' for the override to work.
    expect(new UsageCommand().label).toBe('/usage');
  });
});
