import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useBridgeContext } from '@/contexts/BridgeContext';
import { MessageType } from '@/shared';

/**
 * Raw account payload returned by GET_ACCOUNT (ClaudeAuthStatus + profile API
 * additions). Mirrors the shape both AuthContext and the account modal consume.
 */
export interface AccountData {
  loggedIn?: boolean;
  authMethod?: string;
  email?: string | null;
  subscriptionType?: string | null;
  orgId?: string | null;
  orgName?: string | null;
}

/** Resolved account state. `account` is null when the backend definitively
 * answered "not logged in" (status='error', e.g. credentials not found). */
export interface AccountQueryResult {
  loggedIn: boolean;
  account: AccountData | null;
}

interface RawAccountResponse {
  status?: string;
  account?: AccountData;
  error?: string | null;
}

/**
 * Shared GET_ACCOUNT query — the single source of truth for CLI auth/account
 * status across AuthContext and the account modal. Any number of consumers that
 * read `[MessageType.GET_ACCOUNT]` share one in-flight request and one cache
 * entry, so the previously-duplicated GET_ACCOUNT fan-out collapses to one call.
 *
 * Two distinct failure modes are kept apart, matching the prior hand-rolled
 * AuthContext behaviour:
 * - A transport/CLI failure *rejects* (throws). react-query then keeps the last
 *   successful `data` in cache, so a transient error never flips a known state;
 *   with no prior data the consumer reads `undefined` → undetermined.
 * - A received `status='error'` is a definitive "not logged in" answer and
 *   resolves to `{ loggedIn: false, account: null }`.
 */
export function useAccountQuery(): UseQueryResult<AccountQueryResult, Error> {
  const { isConnected, send } = useBridgeContext();

  return useQuery<AccountQueryResult, Error>({
    queryKey: [MessageType.GET_ACCOUNT],
    enabled: isConnected,
    queryFn: async () => {
      const result = (await send(MessageType.GET_ACCOUNT, {})) as RawAccountResponse;
      if (result?.status === 'ok' && result.account) {
        return { loggedIn: result.account.loggedIn === true, account: result.account };
      }
      return { loggedIn: false, account: null };
    },
  });
}
