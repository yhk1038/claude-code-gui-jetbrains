import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Route } from '@/router/routes';

const { mockNavigate, mockRequest, mockRefetch, mockSubscribe, mockSendRaw, mockOpenUrl } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockRequest: vi.fn(),
  mockRefetch: vi.fn(),
  mockSubscribe: vi.fn((_type: string, _handler: (m: unknown) => void) => () => {}),
  mockSendRaw: vi.fn(),
  mockOpenUrl: vi.fn(),
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
  getAdapter: () => ({ openUrl: mockOpenUrl, openTerminal: vi.fn() }),
}));

import { SwitchAccountPage } from '../index';

/** Subscribe to a specific bridge message type, capturing its handler to fire later. */
function captureHandlers() {
  const handlers: Record<string, (m: unknown) => void> = {};
  mockSubscribe.mockImplementation((type: string, handler: (m: unknown) => void) => {
    handlers[type] = handler;
    return () => {};
  });
  return handlers;
}

describe('SwitchAccountPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRequest.mockReset();
    mockRefetch.mockReset();
    mockSendRaw.mockReset();
    mockSubscribe.mockReset();
    mockOpenUrl.mockReset();
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

  // Issue #57: a pasted code is needed only when the browser's callback page can't
  // reach claude's local loopback server (e.g. WSL) — and the CLI output is
  // identical whether or not it's needed (it always prints "Paste code here if
  // prompted >"). So we cannot auto-detect it; the code field stays collapsed
  // until the user reveals it (they only have a code when their browser showed
  // one). Revealing and submitting it sends SUBMIT_LOGIN_CODE.
  it('keeps the code input collapsed until the user reveals it, then submits it (#57)', async () => {
    const handlers = captureHandlers();
    // Keep LOGIN pending so the modal stays open mid-flow.
    let resolveLogin: (v: { status: string }) => void = () => {};
    mockRequest.mockReturnValue(new Promise((res) => { resolveLogin = res; }));
    mockRefetch.mockResolvedValue(undefined);

    render(<SwitchAccountPage />);
    fireEvent.click(screen.getByText('Claude.ai Subscription'));

    await waitFor(() => expect(handlers['LOGIN_URL_AVAILABLE']).toBeDefined());
    act(() => {
      handlers['LOGIN_URL_AVAILABLE']({ type: 'LOGIN_URL_AVAILABLE', payload: { url: 'https://claude.ai/oauth/authorize?a=1' } });
    });

    // The modal is open but the code field is collapsed by default.
    await screen.findByText('Open sign-in page');
    expect(screen.queryByPlaceholderText('Paste code here')).toBeNull();

    // The user reveals it only when their browser handed them a code.
    fireEvent.click(screen.getByText('Received a code in your browser? Enter it'));

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

  // Issue #57 core fix: the backend no longer opens the OAuth URL itself (that
  // double-opens on macOS/Windows where claude also auto-opens). It forwards the
  // URL; we show a modal and open it ONLY when the user clicks the button.
  it('shows the URL modal on LOGIN_URL_AVAILABLE and opens the URL only on user click, never automatically', async () => {
    const handlers = captureHandlers();
    mockRequest.mockReturnValue(new Promise(() => {})); // keep login pending

    render(<SwitchAccountPage />);
    fireEvent.click(screen.getByText('Claude.ai Subscription'));

    await waitFor(() => expect(handlers['LOGIN_URL_AVAILABLE']).toBeDefined());
    // No modal, nothing opened until the URL arrives.
    expect(screen.queryByText('Open sign-in page')).toBeNull();
    expect(mockOpenUrl).not.toHaveBeenCalled();

    const url = 'https://claude.ai/oauth/authorize?code=abc&state=xyz';
    act(() => {
      handlers['LOGIN_URL_AVAILABLE']({ type: 'LOGIN_URL_AVAILABLE', payload: { url } });
    });

    const openBtn = await screen.findByText('Open sign-in page');
    // Modal is shown but the URL is NOT auto-opened.
    expect(mockOpenUrl).not.toHaveBeenCalled();

    // Only a user click opens it.
    fireEvent.click(openBtn);
    expect(mockOpenUrl).toHaveBeenCalledWith(url);
  });
});
