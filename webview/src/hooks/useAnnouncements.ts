import { useCallback, useEffect, useState } from 'react';
import { useBridgeContext } from '@/contexts/BridgeContext';
import { MessageType, type Announcement, type AnnouncementPlacement, type GetAnnouncementsResult } from '@/shared';
import { useVersionInfo } from './useVersionInfo';
import { selectForPlacement } from './announcementEligibility';

interface DismissResponse {
  dismissedIds?: string[];
}

/**
 * SDUI announcements (see `shared/announcement.ts`) for a single UI placement.
 *
 * Fetches the full announcement list + previously-dismissed ids once
 * (`GET_ANNOUNCEMENTS`), then locally filters/sorts to the entries eligible for
 * `placement` — date window, pluginVersion range, and dismiss/frequency rules
 * (pure logic lives in `announcementEligibility.ts`, kept separate for testing).
 *
 * Call this directly from the consuming component per placement, e.g.
 * `useAnnouncements(AnnouncementPlacement.TOP_BANNER)` — no shared placement
 * registry or prop drilling needed, matching this codebase's convention of
 * components reaching for their own data.
 */
export function useAnnouncements(placement: AnnouncementPlacement) {
  const { send } = useBridgeContext();
  const { pluginVersion } = useVersionInfo();
  const [all, setAll] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = (await send(MessageType.GET_ANNOUNCEMENTS, {})) as GetAnnouncementsResult | null;
      setAll(res?.announcements ?? []);
      setDismissedIds(res?.dismissedIds ?? []);
    } catch {
      setAll([]);
      setDismissedIds([]);
    } finally {
      setIsLoading(false);
    }
  }, [send]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dismiss = useCallback(
    async (id: string) => {
      // Optimistic update: hide it immediately, reconcile with the server's
      // dismissedIds once the ACK arrives (matches useTelemetryConsent's pattern
      // of trusting the response but not blocking the UI on it).
      setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      try {
        const res = (await send(MessageType.DISMISS_ANNOUNCEMENT, { id })) as DismissResponse | null;
        if (res?.dismissedIds) setDismissedIds(res.dismissedIds);
      } catch {
        // Keep the optimistic dismissal even if persistence failed silently;
        // a later refresh() will reconcile with the server's actual state.
      }
    },
    [send],
  );

  const announcements = selectForPlacement(all, placement, {
    now: new Date(),
    pluginVersion,
    dismissedIds,
  });

  return { announcements, dismiss, refresh, isLoading };
}
