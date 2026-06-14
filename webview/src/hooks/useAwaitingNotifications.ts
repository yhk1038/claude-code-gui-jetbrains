import { useEffect, useRef } from 'react';
import {
  NotificationKind,
  notify,
  shouldNotifyForBackgroundEvent,
  type SoundSelection,
} from '@/notifications';
import { setUnreadFavicon } from './favicon';

interface AwaitingSignals {
  /** Becomes truthy while the user has a pending tool-permission request. */
  pendingPermission: boolean;
  /** Becomes truthy while the agent is waiting on a plan approval/rejection. */
  pendingPlanApproval: boolean;
  /** Becomes truthy while AskUserQuestion is waiting on the user's answer. */
  pendingUserAnswer: boolean;
}

/**
 * Fires desktop notifications and toggles the unread favicon when the app
 * transitions into a state that needs the user's attention (currently:
 * pending tool-permission, plan-approval, or user-question prompts).
 *
 * Gated by shouldNotifyForBackgroundEvent(): in the browser this fires only
 * while the tab is hidden — if the user is already viewing the session, both
 * the OS notification and the unread badge would be redundant noise. In JCEF it
 * always fires and the IDE host focus-gates the native notification instead. The
 * favicon is restored by useDocumentTitle's visibilitychange handler, which
 * reads the DOM directly so any source can set the unread state.
 *
 * Unread badge and desktop notification always travel together: their
 * shared purpose is to signal "you should be looking at this session right
 * now" regardless of which specific event triggered it.
 */
export function useAwaitingNotifications(
  sessionTitle: string | null,
  soundSelection: SoundSelection,
  signals: AwaitingSignals,
) {
  const sessionTitleRef = useRef(sessionTitle);
  const soundSelectionRef = useRef(soundSelection);
  useEffect(() => {
    sessionTitleRef.current = sessionTitle;
  }, [sessionTitle]);
  useEffect(() => {
    soundSelectionRef.current = soundSelection;
  }, [soundSelection]);

  const wasPendingPermissionRef = useRef(false);
  useEffect(() => {
    const isPending = signals.pendingPermission;
    if (isPending && !wasPendingPermissionRef.current && shouldNotifyForBackgroundEvent()) {
      setUnreadFavicon();
      notify(
        NotificationKind.AWAITING_PERMISSION,
        { sessionTitle: sessionTitleRef.current },
        soundSelectionRef.current,
      );
    }
    wasPendingPermissionRef.current = isPending;
  }, [signals.pendingPermission]);

  const wasPendingPlanRef = useRef(false);
  useEffect(() => {
    const isPending = signals.pendingPlanApproval;
    if (isPending && !wasPendingPlanRef.current && shouldNotifyForBackgroundEvent()) {
      setUnreadFavicon();
      notify(
        NotificationKind.AWAITING_PLAN_APPROVAL,
        { sessionTitle: sessionTitleRef.current },
        soundSelectionRef.current,
      );
    }
    wasPendingPlanRef.current = isPending;
  }, [signals.pendingPlanApproval]);

  const wasPendingUserAnswerRef = useRef(false);
  useEffect(() => {
    const isPending = signals.pendingUserAnswer;
    if (isPending && !wasPendingUserAnswerRef.current && shouldNotifyForBackgroundEvent()) {
      setUnreadFavicon();
      notify(
        NotificationKind.AWAITING_USER_INPUT,
        { sessionTitle: sessionTitleRef.current },
        soundSelectionRef.current,
      );
    }
    wasPendingUserAnswerRef.current = isPending;
  }, [signals.pendingUserAnswer]);
}
