import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useBridgeContext } from '@/contexts/BridgeContext';
import { MessageType, type AccountListItem, type AccountsResult } from '@/shared';

interface RawAccountsResponse {
  status?: string;
  accounts?: AccountListItem[];
  activeEmail?: string | null;
  error?: string | null;
}

/**
 * Saved Claude accounts for the multi-account switcher.
 *
 * Reads GET_ACCOUNTS (the list + which one is live) and exposes save/switch/delete
 * actions. Each action invalidates both `[GET_ACCOUNTS]` (this list) and
 * `[GET_ACCOUNT]` (the single-account Profile/auth state) so the whole UI reflects
 * the change. An ACCOUNTS_CHANGED push (e.g. a switch from another window) does the
 * same invalidation.
 */
export interface UseAccountsResult {
  accounts: AccountListItem[];
  activeEmail: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  save: () => Promise<void>;
  switchTo: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function useAccountsQuery(): UseQueryResult<AccountsResult, Error> {
  const { isConnected, send } = useBridgeContext();
  return useQuery<AccountsResult, Error>({
    queryKey: [MessageType.GET_ACCOUNTS],
    enabled: isConnected,
    // External (terminal) account switches emit no ACCOUNTS_CHANGED, so override
    // the global staleTime:Infinity / refetchOnWindowFocus:false: refetch the
    // saved list + active marker when the IDE regains focus / reconnects.
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      const result = (await send(MessageType.GET_ACCOUNTS)) as RawAccountsResponse;
      if (result?.status === 'ok') {
        return { accounts: result.accounts ?? [], activeEmail: result.activeEmail ?? null };
      }
      throw new Error(result?.error ?? 'Failed to load accounts');
    },
  });
}

export function useAccounts(): UseAccountsResult {
  const { send, subscribe } = useBridgeContext();
  const queryClient = useQueryClient();
  const query = useAccountsQuery();

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [MessageType.GET_ACCOUNTS] });
    void queryClient.invalidateQueries({ queryKey: [MessageType.GET_ACCOUNT] });
    void queryClient.invalidateQueries({ queryKey: [MessageType.GET_USAGE] });
    void queryClient.invalidateQueries({ queryKey: [MessageType.GET_ALL_USAGE] });
  }, [queryClient]);

  // Refetch when any window changes the registry or switches the live account.
  useEffect(() => {
    const unsubscribe = subscribe(MessageType.ACCOUNTS_CHANGED, () => invalidateAll());
    return unsubscribe;
  }, [subscribe, invalidateAll]);

  const runAction = useCallback(
    async (type: MessageType, payload?: Record<string, unknown>) => {
      const result = (await send(type, payload)) as { status?: string; error?: string };
      if (result?.status !== 'ok') {
        throw new Error(result?.error ?? 'Account action failed');
      }
      invalidateAll();
    },
    [send, invalidateAll],
  );

  const save = useCallback(() => runAction(MessageType.SAVE_ACCOUNT), [runAction]);
  const switchTo = useCallback((id: string) => runAction(MessageType.SWITCH_ACCOUNT, { id }), [runAction]);
  const remove = useCallback((id: string) => runAction(MessageType.DELETE_ACCOUNT, { id }), [runAction]);

  return {
    accounts: query.data?.accounts ?? [],
    activeEmail: query.data?.activeEmail ?? null,
    isLoading: query.isLoading,
    error: query.isError ? (query.error?.message ?? 'Unknown error') : null,
    refetch: query.refetch,
    save,
    switchTo,
    remove,
  };
}
