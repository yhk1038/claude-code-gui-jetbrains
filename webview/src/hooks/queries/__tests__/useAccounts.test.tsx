import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { focusManager } from '@tanstack/react-query';
import { MessageType } from '@/shared';
import { createTestQueryClient, makeQueryWrapper } from './testQueryClient';

const { mockSend, mockSubscribe } = vi.hoisted(() => ({ mockSend: vi.fn(), mockSubscribe: vi.fn() }));
let connected = true;
// Captured ACCOUNTS_CHANGED handler so the test can simulate a push.
let changedHandler: (() => void) | null = null;

vi.mock('@/contexts/BridgeContext', () => ({
  useBridgeContext: () => ({ isConnected: connected, send: mockSend, subscribe: mockSubscribe, lastError: null }),
}));

import { useAccounts, type UseAccountsResult } from '../useAccounts';

const sample = {
  status: 'ok',
  accounts: [
    { id: 'acc-1', emailAddress: 'a@x.com', displayName: null, organizationName: null, subscriptionType: 'team', authMethod: 'claudeai', createdAt: 1, updatedAt: 2, active: true },
  ],
  activeEmail: 'a@x.com',
};

let current: UseAccountsResult | null = null;
function Probe() {
  current = useAccounts();
  return null;
}

function renderHook() {
  const client = createTestQueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  render(<Probe />, { wrapper: makeQueryWrapper(client) });
  return { invalidateSpy };
}

describe('useAccounts', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSubscribe.mockReset();
    // focusManager is a global singleton; restore system default so focus state
    // never leaks between tests.
    focusManager.setFocused(undefined);
    connected = true;
    current = null;
    changedHandler = null;
    mockSubscribe.mockImplementation((type: string, handler: () => void) => {
      if (type === MessageType.ACCOUNTS_CHANGED) changedHandler = handler;
      return () => undefined;
    });
  });

  it('loads the saved accounts and active email from GET_ACCOUNTS', async () => {
    mockSend.mockResolvedValue(sample);
    renderHook();
    await waitFor(() => expect(current?.accounts.length).toBe(1));
    expect(current?.activeEmail).toBe('a@x.com');
    expect(mockSend.mock.calls.filter((c) => c[0] === MessageType.GET_ACCOUNTS).length).toBe(1);
  });

  it('switchTo sends SWITCH_ACCOUNT with the id and invalidates both account queries', async () => {
    mockSend.mockResolvedValue(sample);
    const { invalidateSpy } = renderHook();
    await waitFor(() => expect(current).not.toBeNull());

    mockSend.mockResolvedValueOnce({ status: 'ok' });
    await act(async () => { await current!.switchTo('acc-2'); });

    expect(mockSend).toHaveBeenCalledWith(MessageType.SWITCH_ACCOUNT, { id: 'acc-2' });
    const keys = invalidateSpy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey[0]);
    expect(keys).toContain(MessageType.GET_ACCOUNTS);
    expect(keys).toContain(MessageType.GET_ACCOUNT);
  });

  it('save sends SAVE_ACCOUNT and remove sends DELETE_ACCOUNT with the id', async () => {
    mockSend.mockResolvedValue(sample);
    renderHook();
    await waitFor(() => expect(current).not.toBeNull());

    mockSend.mockResolvedValueOnce({ status: 'ok' });
    await act(async () => { await current!.save(); });
    expect(mockSend).toHaveBeenCalledWith(MessageType.SAVE_ACCOUNT, undefined);

    mockSend.mockResolvedValueOnce({ status: 'ok' });
    await act(async () => { await current!.remove('acc-1'); });
    expect(mockSend).toHaveBeenCalledWith(MessageType.DELETE_ACCOUNT, { id: 'acc-1' });
  });

  it('throws when an action returns a non-ok status', async () => {
    mockSend.mockResolvedValue(sample);
    renderHook();
    await waitFor(() => expect(current).not.toBeNull());

    mockSend.mockResolvedValueOnce({ status: 'error', error: 'keychain locked' });
    await expect(current!.switchTo('acc-2')).rejects.toThrow(/keychain locked/);
  });

  it('does not refetch GET_ACCOUNTS on window focus (event-only policy)', async () => {
    mockSend.mockResolvedValue(sample);
    renderHook();
    await waitFor(() => expect(current?.accounts.length).toBe(1));
    const countGetAccounts = () =>
      mockSend.mock.calls.filter((c) => c[0] === MessageType.GET_ACCOUNTS).length;
    expect(countGetAccounts()).toBe(1);

    // Simulate the IDE window regaining focus. With the event-only policy
    // (staleTime:Infinity / refetchOnWindowFocus:false) this must NOT refetch.
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await Promise.resolve();
    });

    expect(countGetAccounts()).toBe(1);
  });

  it('refetches both account queries on an ACCOUNTS_CHANGED push', async () => {
    mockSend.mockResolvedValue(sample);
    const { invalidateSpy } = renderHook();
    await waitFor(() => expect(changedHandler).not.toBeNull());

    invalidateSpy.mockClear();
    act(() => { changedHandler?.(); });

    const keys = invalidateSpy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey[0]);
    expect(keys).toContain(MessageType.GET_ACCOUNTS);
    expect(keys).toContain(MessageType.GET_ACCOUNT);
  });
});
