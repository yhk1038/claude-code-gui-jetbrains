import { useCallback, useEffect, useState } from 'react';
import { useBridgeContext } from '@/contexts/BridgeContext';

/**
 * 텔레메트리 동의 상태. 백엔드 `profile.ts`의 ConsentStatus와 값이 일치해야 한다
 * (settings.ts ↔ Kotlin SettingKey 동기화와 같은 원칙).
 */
export enum ConsentStatus {
  PENDING = 'pending',
  GRANTED = 'granted',
  DENIED = 'denied',
}

interface ConsentResponse {
  consentStatus: ConsentStatus;
  decidedAt: string | null;
}

/** profile.json의 텔레메트리 동의 상태를 읽고, 수락/거절을 영속화하는 훅. */
export function useTelemetryConsent() {
  const { send } = useBridgeContext();
  const [status, setStatus] = useState<ConsentStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = (await send('GET_TELEMETRY_CONSENT', {})) as ConsentResponse | null;
      setStatus(res?.consentStatus ?? null);
    } catch {
      setStatus(null);
    }
  }, [send]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accept = useCallback(async () => {
    const res = (await send('SET_TELEMETRY_CONSENT', { granted: true })) as ConsentResponse | null;
    setStatus(res?.consentStatus ?? ConsentStatus.GRANTED);
  }, [send]);

  const decline = useCallback(async () => {
    const res = (await send('SET_TELEMETRY_CONSENT', { granted: false })) as ConsentResponse | null;
    setStatus(res?.consentStatus ?? ConsentStatus.DENIED);
  }, [send]);

  return { status, accept, decline, refresh };
}
