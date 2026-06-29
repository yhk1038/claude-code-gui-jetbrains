import { describe, it, expect, vi } from 'vitest';
import { contextItems } from '../items';
import { StaticItem } from '../../../types';
import type { CommandPaletteServices } from '../../../types';

const byId = (id: string): StaticItem =>
  contextItems.find((item) => item.id === id) as StaticItem;

describe('contextItems — open-workflows', () => {
  it('is a search-only item that surfaces under the /workflows query', () => {
    const wf = byId('open-workflows');
    expect(wf).toBeDefined();
    expect(wf.label).toBe('Workflow: Show background tasks');
    expect(wf.searchOnly).toBe(true);
    expect(wf.keywords).toContain('workflows');
  });

  it('opens the Background tasks panel without sending a message to Claude', async () => {
    const openPanel = vi.fn();
    const sendMessage = vi.fn();
    const services = {
      chatStream: { sendMessage },
      workflowState: { openPanel },
    } as unknown as CommandPaletteServices;

    const wf = byId('open-workflows');
    wf._bind(() => services);

    await wf.execute();

    expect(openPanel).toHaveBeenCalledTimes(1);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
