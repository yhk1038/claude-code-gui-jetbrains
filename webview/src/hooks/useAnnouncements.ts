import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBridgeContext } from '@/contexts/BridgeContext';
import {
  AnnouncementFrequency,
  MessageType,
  type Announcement,
  type AnnouncementPlacement,
  type GetAnnouncementsResult,
} from '@/shared';
import { useVersionInfo } from './useVersionInfo';
import { selectForPlacement } from './announcementEligibility';

interface AnnouncementsData {
  announcements: Announcement[];
  dismissedIds: string[];
}

interface DismissResponse {
  dismissedIds?: string[];
}

const ANNOUNCEMENTS_QUERY_KEY = [MessageType.GET_ANNOUNCEMENTS];

/**
 * SDUI announcements (see `shared/announcement.ts`) for a single UI placement.
 *
 * Every placement slot shares ONE React Query (`[GET_ANNOUNCEMENTS]`), so the feed
 * + dismissedIds are fetched once no matter how many slots mount concurrently —
 * then each slot locally filters/sorts to the entries eligible for `placement`
 * (date window, pluginVersion range, dismiss/frequency; pure logic in
 * `announcementEligibility.ts`).
 *
 * Dismissal is dual-tracked:
 * - **Permanent** (`dismissedIds` in the shared query cache, mirrored to
 *   profile.json via `DISMISS_ANNOUNCEMENT`): recorded for ONCE (the moment it is
 *   shown — see the exposure effect below) and UNTIL_DISMISSED (when closed).
 *   ALWAYS is never written here.
 * - **Local** (`locallyDismissedIds`, hook-instance `useState`, volatile): every
 *   frequency's "hide in the current view". Because it lives in this hook
 *   instance, a slot remount resets it — which is exactly what makes an ALWAYS
 *   announcement reappear on re-query.
 *
 * Call this directly from the consuming component per placement, e.g.
 * `useAnnouncements(AnnouncementPlacement.TOP_BANNER)` — no prop drilling.
 */
export function useAnnouncements(placement: AnnouncementPlacement) {
  const { isConnected, send } = useBridgeContext();
  const { pluginVersion } = useVersionInfo();
  const queryClient = useQueryClient();
  const [locallyDismissedIds, setLocallyDismissedIds] = useState<string[]>([]);

  const query = useQuery<AnnouncementsData, Error>({
    queryKey: ANNOUNCEMENTS_QUERY_KEY,
    enabled: isConnected,
    queryFn: async () => {
      const res = (await send(MessageType.GET_ANNOUNCEMENTS, {})) as GetAnnouncementsResult | null;
      return {
        announcements: res?.announcements ?? [],
        dismissedIds: res?.dismissedIds ?? [],
      };
    },
  });

  const all = query.data?.announcements ?? [];
  const dismissedIds = query.data?.dismissedIds ?? [];

  // Persist a dismissal to profile.json (via the shared query cache). Used both
  // for user-driven dismissals of non-ALWAYS announcements and for the ONCE
  // "seen on exposure" record below.
  const persistDismiss = useCallback(
    (id: string) => {
      // Optimistic: reflect the dismissal in the shared cache immediately so every
      // slot hides it at once, then reconcile with the server's dismissedIds.
      queryClient.setQueryData<AnnouncementsData>(ANNOUNCEMENTS_QUERY_KEY, (prev) =>
        prev && !prev.dismissedIds.includes(id) ? { ...prev, dismissedIds: [...prev.dismissedIds, id] } : prev,
      );
      void (async () => {
        try {
          const res = (await send(MessageType.DISMISS_ANNOUNCEMENT, { id })) as DismissResponse | null;
          if (res?.dismissedIds) {
            const confirmed = res.dismissedIds;
            queryClient.setQueryData<AnnouncementsData>(ANNOUNCEMENTS_QUERY_KEY, (prev) =>
              prev ? { ...prev, dismissedIds: confirmed } : prev,
            );
          }
        } catch {
          // Keep the optimistic dismissal even if persistence failed silently;
          // a later refetch will reconcile with the server's actual state.
        }
      })();
    },
    [send, queryClient],
  );

  const dismiss = useCallback(
    (announcement: Announcement) => {
      // Always hide it in the current view (all frequencies).
      setLocallyDismissedIds((prev) => (prev.includes(announcement.id) ? prev : [...prev, announcement.id]));
      // ALWAYS is local-only: never persisted, so it comes back on re-query.
      if (announcement.target.frequency === AnnouncementFrequency.ALWAYS) return;
      // ONCE / UNTIL_DISMISSED: also record permanently.
      persistDismiss(announcement.id);
    },
    [persistDismiss],
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY });
  }, [queryClient]);

  const announcements = selectForPlacement(all, placement, {
    now: new Date(),
    pluginVersion,
    dismissedIds,
    locallyDismissedIds,
  });

  // ONCE = "seen the moment it appears": any ONCE announcement currently shown in
  // this placement and not yet permanently recorded gets recorded now, so it won't
  // reappear on the next query. Guarded by `dismissedIds` membership to avoid an
  // infinite persist/re-render loop (once recorded, it drops out of `announcements`).
  useEffect(() => {
    for (const announcement of announcements) {
      if (announcement.target.frequency === AnnouncementFrequency.ONCE && !dismissedIds.includes(announcement.id)) {
        persistDismiss(announcement.id);
      }
    }
  }, [announcements, dismissedIds, persistDismiss]);

  return { announcements, dismiss, refresh, isLoading: query.isLoading };
}
