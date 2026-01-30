import { createContext, useContext, ReactNode } from 'react';
import { useBridge } from '../hooks/useBridge';

type BridgeContextType = ReturnType<typeof useBridge>;

const BridgeContext = createContext<BridgeContextType | null>(null);

interface BridgeProviderProps {
  children: ReactNode;
}

export function BridgeProvider({ children }: BridgeProviderProps) {
  const bridge = useBridge();

  return (
    <BridgeContext.Provider value={bridge}>
      {children}
    </BridgeContext.Provider>
  );
}

export function useBridgeContext(): BridgeContextType {
  const context = useContext(BridgeContext);
  if (!context) {
    throw new Error('useBridgeContext must be used within a BridgeProvider');
  }
  return context;
}
