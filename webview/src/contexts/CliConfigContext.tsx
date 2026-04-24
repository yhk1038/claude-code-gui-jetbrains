import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useBridge } from '@/hooks/useBridge';
import { useWorkingDir } from '@/contexts/WorkingDirContext';
import type { CliConfigControlResponse } from '@/types/slashCommand';

interface CliConfigContextValue {
  controlResponse: CliConfigControlResponse | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const CliConfigContext = createContext<CliConfigContextValue | null>(null);

interface Props {
  children: ReactNode;
}

export function CliConfigProvider(props: Props) {
  const { children } = props;
  const { isConnected, send } = useBridge();
  const { workingDirectory } = useWorkingDir();
  const [controlResponse, setControlResponse] = useState<CliConfigControlResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCliConfig = useCallback(async (refresh = false) => {
    if (!isConnected) return;

    try {
      const response = await send('GET_CLI_CONFIG', {
        workingDir: workingDirectory ?? undefined,
        refresh,
      });
      const cr = (response as Record<string, unknown>)?.controlResponse as CliConfigControlResponse | undefined;
      if (cr) {
        setControlResponse(cr);
      } else {
        console.warn('[CliConfigContext] No controlResponse in response');
      }
    } catch (err) {
      console.error('[CliConfigContext] Failed to load CLI config:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, send, workingDirectory]);

  useEffect(() => {
    fetchCliConfig();
  }, [fetchCliConfig]);

  const refresh = useCallback(() => fetchCliConfig(true), [fetchCliConfig]);

  return (
    <CliConfigContext.Provider value={{ controlResponse, isLoading, refresh }}>
      {children}
    </CliConfigContext.Provider>
  );
}

export function useCliConfig(): CliConfigContextValue {
  const context = useContext(CliConfigContext);
  if (!context) {
    throw new Error('useCliConfig must be used within a CliConfigProvider');
  }
  return context;
}
