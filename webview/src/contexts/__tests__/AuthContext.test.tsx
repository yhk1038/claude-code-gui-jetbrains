import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/hooks/queries/__tests__/testQueryClient';

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));
let connected = true;

vi.mock('../BridgeContext', () => ({
  useBridgeContext: () => ({ isConnected: connected, send: mockSend, subscribe: vi.fn(), lastError: null }),
}));

vi.mock('@/contexts/WorkingDirContext', () => ({
  useWorkingDir: () => ({ workingDirectory: null }),
}));

import { AuthProvider, useAuthContext } from '../AuthContext';

const wrapper = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => createTestQueryClient());
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
};

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

  it('stays null (undetermined) when the auth status check fails (status error) — never asserts logout (#178)', async () => {
    mockSend.mockResolvedValue({ status: 'error', error: 'auth status check failed' });
    const { result } = renderHook(() => useAuthContext(), { wrapper });
    // give the effect a chance to run and throw
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.loggedIn).toBeNull();
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
    mockSend.mockResolvedValueOnce({ status: 'ok', account: { loggedIn: false } });
    const { result } = renderHook(() => useAuthContext(), { wrapper });
    await waitFor(() => expect(result.current.loggedIn).toBe(false));

    mockSend.mockResolvedValueOnce({ status: 'ok', account: { loggedIn: true } });
    await act(async () => { result.current.refetch(); });
    await waitFor(() => expect(result.current.loggedIn).toBe(true));
  });
});
