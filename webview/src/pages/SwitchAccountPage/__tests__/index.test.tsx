import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Route } from '@/router/routes';

const { mockNavigate, mockRequest, mockRefetch } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockRequest: vi.fn(),
  mockRefetch: vi.fn(),
}));

vi.mock('@/router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));
vi.mock('@/api/bridge/Bridge', () => ({
  getBridge: () => ({ request: mockRequest }),
  LOGIN_REQUEST_TIMEOUT_MS: 300000,
}));
vi.mock('@/contexts', () => ({
  useAuthContext: () => ({ loggedIn: null, refetch: mockRefetch }),
}));
vi.mock('@/contexts/SessionContext', () => ({
  useSessionContext: () => ({ workingDirectory: '/tmp' }),
}));
vi.mock('@/adapters', () => ({
  getAdapter: () => ({ openUrl: vi.fn(), openTerminal: vi.fn() }),
}));

import { SwitchAccountPage } from '../index';

describe('SwitchAccountPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRequest.mockReset();
    mockRefetch.mockReset();
  });

  // Regression for issue #99 (cause B): after a login completes, the chat login
  // gate reads AuthContext.loggedIn. If we navigate before re-querying auth
  // status, loggedIn is still the stale `false` and the gate bounces the user
  // straight back to the login screen. refetch() must run (and resolve) before
  // navigate() so the gate sees the fresh logged-in state.
  it('refetches auth state before navigating to chat after a successful login (#99)', async () => {
    mockRequest.mockResolvedValue({ status: 'ok' });
    mockRefetch.mockResolvedValue(undefined);

    render(<SwitchAccountPage />);
    fireEvent.click(screen.getByText('Claude.ai Subscription'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(Route.NEW_SESSION));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(mockRefetch.mock.invocationCallOrder[0]).toBeLessThan(
      mockNavigate.mock.invocationCallOrder[0],
    );
  });

  it('does not navigate or refetch when login fails', async () => {
    mockRequest.mockResolvedValue({ status: 'error', error: 'Login failed' });

    render(<SwitchAccountPage />);
    fireEvent.click(screen.getByText('Claude.ai Subscription'));

    await waitFor(() => screen.getByText('Login failed'));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockRefetch).not.toHaveBeenCalled();
  });
});
