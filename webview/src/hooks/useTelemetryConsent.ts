import { useCallback, useEffect, useState } from 'react';
import { useBridgeContext } from '@/contexts/BridgeContext';

/**
 * 텔레메트리 동의 상태. 백엔드 `profile.ts`의 ConsentStatus와 값이 일치해야 한다
 * (settings.ts ↔ Kotlin SettingKey 동기화와 같은 원칙).
 */
export enum ConsentStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DENIED = 'denied',
}

/** 동의를 결정한 경로(이벤트 분석용). */
export enum ConsentSource {
  BANNER = 'banner',
  SETTINGS = 'settings',
}

interface ConsentResponse {
  consentStatus: ConsentStatus;
  decidedAt: string | null;
}

/**
 * profile.json의 텔레메트리 동의 상태를 읽고, 수락(accept)/거부(deny)를 영속화하는 훅.
 * 동의 변경 이벤트(accept/deny + source) 전송은 백엔드 핸들러가 처리한다
 * (특히 deny는 저장 전에 전송해 철회 시점의 ACCEPTED 상태로 게이팅을 통과).
 */
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

  const accept = useCallback(
    async (source: ConsentSource) => {
      const res = (await send('SET_TELEMETRY_CONSENT', { accepted: true, source })) as ConsentResponse | null;
      setStatus(res?.consentStatus ?? ConsentStatus.ACCEPTED);
    },
    [send],
  );

  const deny = useCallback(
    async (source: ConsentSource) => {
      const res = (await send('SET_TELEMETRY_CONSENT', { accepted: false, source })) as ConsentResponse | null;
      setStatus(res?.consentStatus ?? ConsentStatus.DENIED);
    },
    [send],
  );

  return { status, accept, deny, refresh };
}
