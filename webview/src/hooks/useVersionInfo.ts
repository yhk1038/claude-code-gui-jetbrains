import { useState, useEffect, useCallback } from 'react';
import { useBridgeContext } from '@/contexts/BridgeContext';

interface VersionInfo {
  pluginVersion: string;
  cliVersion: string | null;
}

interface UseVersionInfoReturn {
  pluginVersion: string;
  cliVersion: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

// Module-level cache: persists across component mounts/unmounts
let cachedVersion: VersionInfo | null = null;

export function useVersionInfo(): UseVersionInfoReturn {
  const { isConnected, send } = useBridgeContext();
  const [version, setVersion] = useState<VersionInfo | null>(cachedVersion);
  const [isLoading, setIsLoading] = useState(false);

  const fetchVersion = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await send('GET_VERSION', {});
      if (result.status === 'ok') {
        const info: VersionInfo = {
          pluginVersion: result.pluginVersion ?? 'unknown',
          cliVersion: result.cliVersion ?? null,
        };
        cachedVersion = info;
        setVersion(info);
      }
    } catch (err) {
      console.warn('Failed to fetch version info:', err);
    } finally {
      setIsLoading(false);
    }
  }, [send]);

  useEffect(() => {
    if (isConnected && !cachedVersion) {
      fetchVersion();
    }
  }, [isConnected, fetchVersion]);

  return {
    pluginVersion: version?.pluginVersion ?? '...',
    cliVersion: version?.cliVersion ?? null,
    isLoading,
    refresh: fetchVersion,
  };
}
