import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { MessageType } from '@/shared';

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock('@/contexts/BridgeContext', () => ({
  useBridgeContext: () => ({ send: mockSend, isConnected: true, subscribe: vi.fn(), lastError: null }),
}));

import { useAnnouncementsEnabled } from '../useAnnouncementsEnabled';

type HookReturn = ReturnType<typeof useAnnouncementsEnabled>;

let current: HookReturn | null = null;
function Probe() {
  current = useAnnouncementsEnabled();
  return null;
}

describe('useAnnouncementsEnabled', () => {
  beforeEach(() => {
    mockSend.mockReset();
    current = null;
  });

  it('fetches the current state via GET_ANNOUNCEMENTS_ENABLED on mount', async () => {
    mockSend.mockResolvedValue({ enabled: false });
    render(<Probe />);

    await waitFor(() => expect(current?.enabled).toBe(false));
    expect(mockSend).toHaveBeenCalledWith(MessageType.GET_ANNOUNCEMENTS_ENABLED, {});
  });

  it('defaults to true when the GET call throws', async () => {
    mockSend.mockRejectedValue(new Error('boom'));
    render(<Probe />);

    await waitFor(() => expect(current?.enabled).toBe(true));
  });

  it('setEnabled(false) sends SET_ANNOUNCEMENTS_ENABLED and updates local state', async () => {
    mockSend.mockResolvedValue({ enabled: true });
    render(<Probe />);
    await waitFor(() => expect(current?.enabled).toBe(true));

    mockSend.mockResolvedValue({ enabled: false });
    await act(async () => {
      await current!.setEnabled(false);
    });

    expect(mockSend).toHaveBeenCalledWith(MessageType.SET_ANNOUNCEMENTS_ENABLED, { enabled: false });
    expect(current?.enabled).toBe(false);
  });

  it('setEnabled(true) sends SET_ANNOUNCEMENTS_ENABLED(true)', async () => {
    mockSend.mockResolvedValue({ enabled: false });
    render(<Probe />);
    await waitFor(() => expect(current?.enabled).toBe(false));

    mockSend.mockResolvedValue({ enabled: true });
    await act(async () => {
      await current!.setEnabled(true);
    });

    expect(mockSend).toHaveBeenCalledWith(MessageType.SET_ANNOUNCEMENTS_ENABLED, { enabled: true });
    expect(current?.enabled).toBe(true);
  });
});
