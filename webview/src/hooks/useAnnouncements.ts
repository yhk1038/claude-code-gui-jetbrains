import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBridgeContext } from '@/contexts/BridgeContext';
import { MessageType, type Announcement, type AnnouncementPlacement, type GetAnnouncementsResult } from '@/shared';
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
 * `announcementEligibility.ts`). `dismiss` writes the shared cache so all slots
 * update at once.
 *
 * Call this directly from the consuming component per placement, e.g.
 * `useAnnouncements(AnnouncementPlacement.TOP_BANNER)` — no prop drilling.
 */
export function useAnnouncements(placement: AnnouncementPlacement) {
  const { isConnected, send } = useBridgeContext();
  const { pluginVersion } = useVersionInfo();
  const queryClient = useQueryClient();

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

  const dismiss = useCallback(
    async (id: string) => {
      // Optimistic: reflect the dismissal in the shared cache immediately so every
      // slot hides it at once, then reconcile with the server's dismissedIds.
      queryClient.setQueryData<AnnouncementsData>(ANNOUNCEMENTS_QUERY_KEY, (prev) =>
        prev && !prev.dismissedIds.includes(id)
          ? { ...prev, dismissedIds: [...prev.dismissedIds, id] }
          : prev,
      );
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
    },
    [send, queryClient],
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_QUERY_KEY });
  }, [queryClient]);

  const announcements = selectForPlacement(all, placement, {
    now: new Date(),
    pluginVersion,
    dismissedIds,
  });

  return { announcements, dismiss, refresh, isLoading: query.isLoading };
}
