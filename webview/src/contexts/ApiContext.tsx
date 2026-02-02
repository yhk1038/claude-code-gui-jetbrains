import { createContext, useContext, useEffect, ReactNode } from 'react';
import { api, ClaudeCodeApi } from '../api';
import { useBridgeContext } from './BridgeContext';

interface ApiContextValue {
  api: ClaudeCodeApi;
  isConnected: boolean;
}

const ApiContext = createContext<ApiContextValue | null>(null);

interface ApiProviderProps {
  children: ReactNode;
}

/**
 * Provider that initializes the ClaudeCodeApi with the bridge connection
 * Must be nested inside BridgeProvider
 */
export function ApiProvider({ children }: ApiProviderProps) {
  const { send, subscribe, isConnected } = useBridgeContext();

  // Initialize API when bridge connection changes
  useEffect(() => {
    api.initialize(send, subscribe, isConnected);
  }, [send, subscribe, isConnected]);

  // Update connection status
  useEffect(() => {
    api.setConnected(isConnected);
  }, [isConnected]);

  const value: ApiContextValue = {
    api,
    isConnected,
  };

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
}

/**
 * Hook to access the API context
 */
export function useApiContext(): ApiContextValue {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApiContext must be used within an ApiProvider');
  }
  return context;
}

/**
 * Hook to access the ClaudeCodeApi instance directly
 */
export function useApi(): ClaudeCodeApi {
  const { api } = useApiContext();
  return api;
}
