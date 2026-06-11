import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));
let connected = true;

vi.mock('../BridgeContext', () => ({
  useBridgeContext: () => ({ isConnected: connected, send: mockSend, subscribe: vi.fn(), lastError: null }),
}));

import { AuthProvider, useAuthContext } from '../AuthContext';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthContext', () => {
  beforeEach(() => {
    mockSend.mockReset();
    connected = true;
  });

  it('reports loggedIn=true when GET_ACCOUNT returns a logged-in account', async () => {
    mockSend.mockResolvedValue({ status: 'ok', account: { loggedIn: true } });
    const { result } = renderHook(() => useAuthContext(), { wrapper });
    await waitFor(() => expect(result.current.loggedIn).toBe(true));
  });

  it('reports loggedIn=false when credentials are not found (status error)', async () => {
    mockSend.mockResolvedValue({ status: 'error', error: 'Claude Code credentials not found.' });
    const { result } = renderHook(() => useAuthContext(), { wrapper });
    await waitFor(() => expect(result.current.loggedIn).toBe(false));
  });

  it('reports loggedIn=false when the account explicitly says loggedIn=false', async () => {
    mockSend.mockResolvedValue({ status: 'ok', account: { loggedIn: false } });
    const { result } = renderHook(() => useAuthContext(), { wrapper });
    await waitFor(() => expect(result.current.loggedIn).toBe(false));
  });

  it('stays null (undetermined) on a transient request failure — does not flip to false', async () => {
    mockSend.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useAuthContext(), { wrapper });
    // give the effect a chance to run and reject
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.loggedIn).toBeNull();
  });

  it('refetch re-queries and updates the state (login completed elsewhere)', async () => {
    mockSend.mockResolvedValueOnce({ status: 'error', error: 'not found' });
    const { result } = renderHook(() => useAuthContext(), { wrapper });
    await waitFor(() => expect(result.current.loggedIn).toBe(false));

    mockSend.mockResolvedValueOnce({ status: 'ok', account: { loggedIn: true } });
    await act(async () => { result.current.refetch(); });
    await waitFor(() => expect(result.current.loggedIn).toBe(true));
  });
});
