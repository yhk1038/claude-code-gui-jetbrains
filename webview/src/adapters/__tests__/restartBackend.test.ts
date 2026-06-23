import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JetBrainsAdapter } from '../JetBrainsAdapter';
import { BrowserAdapter } from '../BrowserAdapter';
import * as BridgeModule from '@/api/bridge/Bridge';

describe('restartBackend', () => {
  let request: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    request = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(BridgeModule, 'getBridge').mockReturnValue({
      request,
    } as unknown as ReturnType<typeof BridgeModule.getBridge>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('JetBrainsAdapter sends RESTART_BACKEND request', async () => {
    await new JetBrainsAdapter().restartBackend();
    expect(request).toHaveBeenCalledWith('RESTART_BACKEND');
  });

  it('BrowserAdapter sends RESTART_BACKEND request', async () => {
    await new BrowserAdapter().restartBackend();
    expect(request).toHaveBeenCalledWith('RESTART_BACKEND');
  });
});
