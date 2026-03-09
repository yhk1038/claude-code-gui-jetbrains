import { useState, useEffect, useCallback } from 'react';
import { useBridgeContext } from '@/contexts/BridgeContext';
import { useChatStreamContext } from '@/contexts/ChatStreamContext';
import type { UsageResponse } from '@/types/usage';

interface UseUsageDataReturn {
  data: UsageResponse | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useUsageData(): UseUsageDataReturn {
  const { isConnected, send } = useBridgeContext();
  const { messages } = useChatStreamContext();
  const [data, setData] = useState<UsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchUsage = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await send('GET_USAGE', {});
      if (result.status === 'ok' && result.usage) {
        setData(result.usage as UsageResponse);
        setLastUpdated(new Date());
        window.dispatchEvent(new CustomEvent('usage-data-updated', { detail: result.usage }));
      } else {
        setError(result.error || 'Failed to fetch usage data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [send]);

  // 초기 연결 시 fetch
  useEffect(() => {
    if (isConnected) {
      fetchUsage();
    }
  }, [isConnected, fetchUsage]);

  // 다른 인스턴스가 fetch 성공 시 데이터 동기화
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<UsageResponse>;
      setData(customEvent.detail);
      setLastUpdated(new Date());
    };
    window.addEventListener('usage-data-updated', handler);
    return () => window.removeEventListener('usage-data-updated', handler);
  }, []);

  // messages 변경 시(새 메시지 수신, 세션 복원, 클리어) refresh
  useEffect(() => {
    if (isConnected) {
      fetchUsage();
    }
  // fetchUsage는 send가 안정적인 한 변하지 않으므로 의존성에서 제외해도 무방하나,
  // eslint 규칙 준수를 위해 포함. messages.length만 감지 대상으로 삼음.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  return { data, isLoading, error, lastUpdated, refresh: fetchUsage };
}
