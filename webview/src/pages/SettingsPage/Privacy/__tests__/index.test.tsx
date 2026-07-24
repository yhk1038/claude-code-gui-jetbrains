import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MessageType } from '@/shared';
import { PrivacySettings } from '../index';

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock('@/contexts/BridgeContext', () => ({
  useBridgeContext: () => ({ send: mockSend, isConnected: true, subscribe: vi.fn(), lastError: null }),
}));

function mockSendImpl(overrides: { announcementsEnabled?: boolean } = {}) {
  const announcementsEnabled = overrides.announcementsEnabled ?? true;
  mockSend.mockImplementation(async (type: MessageType, payload: unknown) => {
    switch (type) {
      case MessageType.GET_TELEMETRY_CONSENT:
        return { consentStatus: 'pending', decidedAt: null };
      case MessageType.SET_TELEMETRY_CONSENT:
        return { consentStatus: 'accepted', decidedAt: '2026-01-01T00:00:00.000Z' };
      case MessageType.GET_ANNOUNCEMENTS_ENABLED:
        return { enabled: announcementsEnabled };
      case MessageType.SET_ANNOUNCEMENTS_ENABLED: {
        const enabled = (payload as { enabled: boolean }).enabled;
        return { enabled };
      }
      default:
        return null;
    }
  });
}

describe('PrivacySettings — announcements toggle', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('loads the current announcements-enabled state from GET_ANNOUNCEMENTS_ENABLED', async () => {
    mockSendImpl({ announcementsEnabled: true });
    render(<PrivacySettings />);

    await waitFor(() => {
      expect(mockSend.mock.calls.some((c) => c[0] === MessageType.GET_ANNOUNCEMENTS_ENABLED)).toBe(
        true,
      );
    });

    const toggle = screen.getByRole('switch', { name: 'Receive announcements' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('turning ON needs no confirmation and calls SET_ANNOUNCEMENTS_ENABLED(true) immediately', async () => {
    mockSendImpl({ announcementsEnabled: false });
    render(<PrivacySettings />);

    const toggle = await screen.findByRole('switch', { name: 'Receive announcements' });
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));

    await act(async () => {
      fireEvent.click(toggle);
    });

    // No confirm dialog for turning on.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      const setCall = mockSend.mock.calls.find((c) => c[0] === MessageType.SET_ANNOUNCEMENTS_ENABLED);
      expect(setCall?.[1]).toEqual({ enabled: true });
    });
  });

  it('turning OFF shows a confirm dialog; cancelling keeps it on (no SET call)', async () => {
    mockSendImpl({ announcementsEnabled: true });
    render(<PrivacySettings />);

    const toggle = await screen.findByRole('switch', { name: 'Receive announcements' });
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Turn off announcements?')).toBeInTheDocument();

    mockSend.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      mockSend.mock.calls.some((c) => c[0] === MessageType.SET_ANNOUNCEMENTS_ENABLED),
    ).toBe(false);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('turning OFF and confirming calls SET_ANNOUNCEMENTS_ENABLED(false)', async () => {
    mockSendImpl({ announcementsEnabled: true });
    render(<PrivacySettings />);

    const toggle = await screen.findByRole('switch', { name: 'Receive announcements' });
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    });

    await waitFor(() => {
      const setCall = mockSend.mock.calls.find((c) => c[0] === MessageType.SET_ANNOUNCEMENTS_ENABLED);
      expect(setCall?.[1]).toEqual({ enabled: false });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
