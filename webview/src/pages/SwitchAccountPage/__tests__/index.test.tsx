import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Route } from '@/router/routes';

const { mockNavigate, mockRequest, mockRefetch, mockSubscribe, mockSendRaw } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockRequest: vi.fn(),
  mockRefetch: vi.fn(),
  mockSubscribe: vi.fn((_type: string, _handler: (m: unknown) => void) => () => {}),
  mockSendRaw: vi.fn(),
}));

vi.mock('@/router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));
vi.mock('@/api/bridge/Bridge', () => ({
  getBridge: () => ({ request: mockRequest, subscribe: mockSubscribe, sendRaw: mockSendRaw }),
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
    mockSendRaw.mockReset();
    mockSubscribe.mockReset();
    // Default: subscribe is a no-op returning an unsubscribe fn.
    mockSubscribe.mockReturnValue(() => {});
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

  // Issue #57: flows that can't auto-complete (e.g. WSL projects) print a code
  // after browser sign-in. The optional code input must stay hidden until the
  // backend emits LOGIN_CODE_REQUIRED, then submitting it sends SUBMIT_LOGIN_CODE.
  it('shows the optional code input only when the CLI requests a code, then submits it (#57)', async () => {
    // Capture the LOGIN_CODE_REQUIRED handler so we can fire it mid-login.
    let codeHandler: ((m: unknown) => void) | undefined;
    mockSubscribe.mockImplementation((type: string, handler: (m: unknown) => void) => {
      if (type === 'LOGIN_CODE_REQUIRED') codeHandler = handler;
      return () => {};
    });
    // Keep LOGIN pending so the input can appear mid-flow.
    let resolveLogin: (v: { status: string }) => void = () => {};
    mockRequest.mockReturnValue(new Promise((res) => { resolveLogin = res; }));
    mockRefetch.mockResolvedValue(undefined);

    render(<SwitchAccountPage />);
    fireEvent.click(screen.getByText('Claude.ai Subscription'));

    // Hidden until the backend asks for a code.
    expect(screen.queryByPlaceholderText('Paste code here')).toBeNull();

    await waitFor(() => expect(codeHandler).toBeDefined());
    codeHandler?.({ type: 'LOGIN_CODE_REQUIRED' });

    const input = await screen.findByPlaceholderText('Paste code here');
    fireEvent.change(input, { target: { value: '  my-code  ' } });
    fireEvent.click(screen.getByText('Submit code'));

    expect(mockSendRaw).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SUBMIT_LOGIN_CODE', payload: { code: 'my-code' } }),
    );

    // Completing the login navigates as usual.
    resolveLogin({ status: 'ok' });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(Route.NEW_SESSION));
  });
});
