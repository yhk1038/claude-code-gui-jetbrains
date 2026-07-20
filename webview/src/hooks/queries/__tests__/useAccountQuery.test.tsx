import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MessageType } from '@/shared';
import { createTestQueryClient, makeQueryWrapper } from './testQueryClient';

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));
let connected = true;

vi.mock('@/contexts/BridgeContext', () => ({
  useBridgeContext: () => ({ isConnected: connected, send: mockSend, subscribe: vi.fn(), lastError: null }),
}));

vi.mock('@/contexts/WorkingDirContext', () => ({
  useWorkingDir: () => ({ workingDirectory: null }),
}));

import { useAccountQuery, type AccountQueryResult } from '../useAccountQuery';

function Consumer() {
  const query = useAccountQuery();
  return <span data-testid="state">{String(query.data?.account?.loggedIn ?? 'pending')}</span>;
}

describe('useAccountQuery', () => {
  beforeEach(() => {
    mockSend.mockReset();
    connected = true;
  });

  it('dedupes: two consumers of the same query trigger GET_ACCOUNT exactly once', async () => {
    mockSend.mockResolvedValue({ status: 'ok', account: { loggedIn: true } });
    const client = createTestQueryClient();
    const wrapper = makeQueryWrapper(client);

    render(
      <>
        <Consumer />
        <Consumer />
      </>,
      { wrapper },
    );

    await waitFor(() => {
      const accountCalls = mockSend.mock.calls.filter((c) => c[0] === MessageType.GET_ACCOUNT);
      expect(accountCalls.length).toBe(1);
    });
  });

  it('does not fetch while disconnected (enabled: isConnected)', async () => {
    connected = false;
    mockSend.mockResolvedValue({ status: 'ok', account: { loggedIn: true } });
    const client = createTestQueryClient();
    const wrapper = makeQueryWrapper(client);

    render(<Consumer />, { wrapper });

    await new Promise((r) => setTimeout(r, 20));
    const accountCalls = mockSend.mock.calls.filter((c) => c[0] === MessageType.GET_ACCOUNT);
    expect(accountCalls.length).toBe(0);
  });

  it('resolves status="ok" with loggedIn:false to a definitive logged-out state (not a query error)', async () => {
    const account = { loggedIn: false, authMethod: 'none' };
    mockSend.mockResolvedValue({ status: 'ok', account });
    const client = createTestQueryClient();
    const wrapper = makeQueryWrapper(client);

    let isError = false;
    let data: AccountQueryResult | undefined;
    function Probe() {
      const query = useAccountQuery();
      isError = query.isError;
      data = query.data;
      return null;
    }
    render(<Probe />, { wrapper });

    await waitFor(() => expect(data).toBeDefined());
    expect(isError).toBe(false);
    expect(data).toEqual({ loggedIn: false, account });
  });

  it('treats status="error" (undetermined) as a query error, keeping the last known state (#178)', async () => {
    // A prior success establishes a known state...
    mockSend.mockResolvedValueOnce({ status: 'ok', account: { loggedIn: true } });
    const client = createTestQueryClient();
    const wrapper = makeQueryWrapper(client);

    let data: AccountQueryResult | undefined;
    let isError = false;
    function Probe() {
      const query = useAccountQuery();
      data = query.data;
      isError = query.isError;
      return null;
    }
    render(<Probe />, { wrapper });
    await waitFor(() => expect(data?.loggedIn).toBe(true));

    // ...an undetermined `status='error'` must throw so the known state is preserved,
    // never flipping the user to logged-out.
    mockSend.mockResolvedValueOnce({ status: 'error', error: 'auth status check failed' });
    await client.invalidateQueries({ queryKey: [MessageType.GET_ACCOUNT] });

    await waitFor(() => expect(isError).toBe(true));
    expect(data?.loggedIn).toBe(true);
  });

  it('keeps the prior success in cache when the transport rejects', async () => {
    mockSend.mockResolvedValueOnce({ status: 'ok', account: { loggedIn: true } });
    const client = createTestQueryClient();
    const wrapper = makeQueryWrapper(client);

    let data: AccountQueryResult | undefined;
    let isError = false;
    function Probe() {
      const query = useAccountQuery();
      data = query.data;
      isError = query.isError;
      return null;
    }
    render(<Probe />, { wrapper });
    await waitFor(() => expect(data?.loggedIn).toBe(true));

    // A subsequent transport failure (reject) must not clobber the known state.
    mockSend.mockRejectedValueOnce(new Error('network'));
    await client.invalidateQueries({ queryKey: [MessageType.GET_ACCOUNT] });

    await waitFor(() => expect(isError).toBe(true));
    expect(data?.loggedIn).toBe(true);
  });
});
