import { describe, it, expect, vi } from 'vitest';
import { UsageCommand } from '../UsageCommand';
import { OPEN_ACCOUNT_USAGE_EVENT } from '../../model/AccountUsageItem';

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
