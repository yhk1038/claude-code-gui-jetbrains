import { useCallback, useEffect, useMemo, useState } from 'react';
import { getBridge } from '../api/bridge/Bridge';

type MessageHandler = (message: IPCMessage) => void;

interface UseBridgeReturn {
  isConnected: boolean;
  send: (type: string, payload: Record<string, unknown>) => Promise<any>;
  subscribe: (type: string, handler: MessageHandler) => () => void;
  lastError: Error | null;
}

/**
 * Bridge 싱글턴의 React 래퍼 훅.
 *
 * 역할:
 * 1. Bridge.isConnected를 React state로 동기화
 * 2. Bridge.lastError를 React state로 동기화
 * 3. Bridge.request()를 send로, Bridge.subscribe()를 subscribe로 위임
 *
 * 기존 useBridge()와 반환 타입 100% 동일 -> 소비자 변경 불필요.
 */
export function useBridge(): UseBridgeReturn {
  const bridge = getBridge();

  const [isConnected, setIsConnected] = useState(bridge.isConnected);
  const [lastError, setLastError] = useState<Error | null>(bridge.lastError);

  // Bridge 연결 상태 변경 -> React state 동기화
  useEffect(() => {
    const unsubscribe = bridge.onConnectionChange((connected) => {
      setIsConnected(connected);
      if (connected) {
        setLastError(null);
      }
    });

    // 초기값 동기화 (Bridge가 이미 연결된 경우)
    setIsConnected(bridge.isConnected);

    return unsubscribe;
  }, [bridge]);

  // send: Bridge.request() 위임 + 에러 시 lastError 업데이트
  const send = useCallback(
    async <T = any>(type: string, payload: Record<string, unknown> = {}): Promise<T> => {
      try {
        return await bridge.request<T>(type, payload);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setLastError(err);
        throw error;
      }
    },
    [bridge]
  );

  // subscribe: Bridge.subscribe() 직접 위임
  const subscribe = useCallback(
    (type: string, handler: MessageHandler): (() => void) => {
      return bridge.subscribe(type, handler);
    },
    [bridge]
  );

  // Stabilize the returned object so consumers using `bridge` as a useEffect
  // dependency (e.g. ChatInput's native-drop subscription) don't re-attach
  // listeners every render. send/subscribe are already useCallback-stable.
  return useMemo(
    () => ({ isConnected, send, subscribe, lastError }),
    [isConnected, send, subscribe, lastError],
  );
}
