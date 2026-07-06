import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSupportItems } from '../items';
import { StaticItem } from '../../../types';
import type { CommandPaletteServices } from '../../../types';
import * as Adapters from '@/adapters';

const supportItems = getSupportItems();

const byId = (id: string): StaticItem =>
  supportItems.find(item => item.id === id) as StaticItem;

const makeServices = (
  confirm: CommandPaletteServices['ui']['confirm'],
): CommandPaletteServices =>
  ({ ui: { confirm } } as unknown as CommandPaletteServices);

describe('supportItems', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes a "Restart plugin" item', () => {
    const restart = byId('restart-plugin');
    expect(restart).toBeDefined();
    expect(restart.label).toBe('Restart plugin');
    expect(restart.disabled).toBe(false);
  });

  it('restarts the backend when the user confirms', async () => {
    const restartBackend = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(Adapters, 'getAdapter').mockReturnValue({
      restartBackend,
    } as unknown as ReturnType<typeof Adapters.getAdapter>);

    const restart = byId('restart-plugin');
    restart._bind(() => makeServices(vi.fn().mockResolvedValue(true)));

    await restart.execute();

    expect(restartBackend).toHaveBeenCalledTimes(1);
  });

  it('does not restart the backend when the user cancels', async () => {
    const restartBackend = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(Adapters, 'getAdapter').mockReturnValue({
      restartBackend,
    } as unknown as ReturnType<typeof Adapters.getAdapter>);

    const restart = byId('restart-plugin');
    restart._bind(() => makeServices(vi.fn().mockResolvedValue(false)));

    await restart.execute();

    expect(restartBackend).not.toHaveBeenCalled();
  });
});
