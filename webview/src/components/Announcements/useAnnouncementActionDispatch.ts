import { useCallback } from 'react';
import { getAdapter } from '@/adapters';
import { useRouter } from '@/router';
import { AnnouncementActionType, type Announcement, type AnnouncementAction } from '@/shared';
import { ANNOUNCEMENT_COMMAND_HANDLERS, isAllowedCommand, isAllowedRoute } from './announcementActionWhitelist';
import { isSafeLinkUrl } from './urlSafety';

export type AnnouncementActionDispatch = (
  announcement: Announcement,
  action: AnnouncementAction,
  onDismiss: (id: string) => void,
) => void;

/**
 * Executes an `Announcement`'s action when its button/link is activated.
 *
 * `OPEN_URL` and `DISMISS` always run (they carry no server-directed target
 * beyond a URL/the announcement's own id). `NAVIGATE`/`RUN_COMMAND` are sealed
 * behind whitelists (`isAllowedRoute`/`isAllowedCommand`) — a target outside
 * the whitelist is `console.warn`'d and dropped, never silently swallowed, so
 * a rejected server instruction still leaves a debuggable trail (marketplace
 * security requirement: no server-driven code/route/command execution
 * outside an explicit allow-list).
 */
export function useAnnouncementActionDispatch(): AnnouncementActionDispatch {
  const { navigate } = useRouter();

  return useCallback(
    (announcement: Announcement, action: AnnouncementAction, onDismiss: (id: string) => void) => {
      switch (action.type) {
        case AnnouncementActionType.OPEN_URL: {
          if (!action.url) return;
          // Same scheme allow-list as restricted-markdown links: a server-sent
          // `javascript:`/`file:`/`data:` URL must never reach the opener.
          if (!isSafeLinkUrl(action.url)) {
            console.warn('[AnnouncementAction] Blocked OPEN_URL with unsafe scheme:', action.url);
            return;
          }
          void getAdapter().openUrl(action.url);
          return;
        }
        case AnnouncementActionType.DISMISS: {
          onDismiss(announcement.id);
          return;
        }
        case AnnouncementActionType.NAVIGATE: {
          if (action.route && isAllowedRoute(action.route)) {
            navigate(action.route);
          } else {
            console.warn('[AnnouncementAction] Blocked NAVIGATE to non-whitelisted route:', action.route);
          }
          return;
        }
        case AnnouncementActionType.RUN_COMMAND: {
          if (action.command && isAllowedCommand(action.command)) {
            void ANNOUNCEMENT_COMMAND_HANDLERS[action.command]();
          } else {
            console.warn('[AnnouncementAction] Blocked RUN_COMMAND for non-whitelisted command:', action.command);
          }
          return;
        }
        default:
          return;
      }
    },
    [navigate],
  );
}
