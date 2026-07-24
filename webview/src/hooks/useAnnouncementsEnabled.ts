import { useCallback, useEffect, useState } from 'react';
import { useBridgeContext } from '@/contexts/BridgeContext';
import { MessageType } from '@/shared';

interface AnnouncementsEnabledResponse {
  enabled: boolean;
}

/**
 * profile.json의 공지(Announcement) 수신 설정을 읽고, on/off를 영속화하는 훅.
 * `useTelemetryConsent` 패턴을 따른다.
 */
export function useAnnouncementsEnabled() {
  const { send } = useBridgeContext();
  const [enabled, setEnabledState] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = (await send(
        MessageType.GET_ANNOUNCEMENTS_ENABLED,
        {},
      )) as AnnouncementsEnabledResponse | null;
      setEnabledState(res?.enabled ?? true);
    } catch {
      setEnabledState(true);
    }
  }, [send]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setEnabled = useCallback(
    async (value: boolean) => {
      const res = (await send(MessageType.SET_ANNOUNCEMENTS_ENABLED, {
        enabled: value,
      })) as AnnouncementsEnabledResponse | null;
      setEnabledState(res?.enabled ?? value);
    },
    [send],
  );

  return { enabled, setEnabled, refresh };
}
