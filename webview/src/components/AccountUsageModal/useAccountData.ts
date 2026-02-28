import { useState, useEffect, useCallback } from 'react';
import { useBridgeContext } from '@/contexts/BridgeContext';

// Raw data from backend (matches ClaudeAuthStatus + profile API additions)
interface RawAccountData {
  loggedIn?: boolean;
  authMethod?: string;       // "claude.ai", "github.com", "api-key", etc.
  email?: string | null;
  subscriptionType?: string | null;  // "max", "pro", "team", "enterprise", "claude_api", or null
  orgId?: string | null;
  orgName?: string | null;
  rateLimitTier?: string | null;
}

// Display-ready data for the UI
interface AccountInfo {
  authMethod: string | null;
  email: string | null;
  plan: string | null;
}

interface UseAccountDataReturn {
  data: AccountInfo | null;
  isLoading: boolean;
  error: string | null;
}

// jO1 equivalent - maps authMethod raw value to display string
function formatAuthMethod(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const normalized = raw.replace(/\./g, '').toLowerCase();
  switch (normalized) {
    case 'claudeai': return 'Claude AI';
    case 'console': return 'Anthropic Console';
    case 'apikey':
    case 'api-key': return 'API Key';
    case '3p': return 'Third Party';
    default: return raw;
  }
}

// BO1 equivalent - snake_case → Title Case
function formatPlan(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function useAccountData(): UseAccountDataReturn {
  const { isConnected, send } = useBridgeContext();
  const [data, setData] = useState<AccountInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccount = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await send('GET_ACCOUNT', {});
      if (result.status === 'ok' && result.account) {
        const rawData = result.account as RawAccountData;
        setData({
          authMethod: formatAuthMethod(rawData.authMethod),
          email: rawData.email ?? null,
          plan: formatPlan(rawData.subscriptionType),
        });
      } else {
        setError(result.error as string | null ?? 'Failed to fetch account data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [send]);

  useEffect(() => {
    if (isConnected) {
      fetchAccount();
    }
  }, [isConnected, fetchAccount]);

  return { data, isLoading, error };
}
