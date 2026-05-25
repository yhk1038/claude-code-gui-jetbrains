import { useEffect, useRef } from 'react';
import {
  NotificationKind,
  notify,
  type SoundSelection,
} from '@/notifications';

interface AwaitingSignals {
  /** Becomes truthy while the user has a pending tool-permission request. */
  pendingPermission: boolean;
  /** Becomes truthy while the agent is waiting on a plan approval/rejection. */
  pendingPlanApproval: boolean;
  /** Becomes truthy while AskUserQuestion is waiting on the user's answer. */
  pendingUserAnswer: boolean;
}

/**
 * Fires desktop notifications when the app transitions into a state that is
 * waiting on the user (currently: pending tool-permission requests). Only
 * notifies while the tab is hidden — when the user can already see the
 * pending UI on screen, the OS notification would be redundant noise.
 *
 * Unlike SESSION_COMPLETE/STREAM_ERROR, "awaiting" notifications do NOT swap
 * the favicon — the in-page pending UI is self-evident once the user returns
 * to the tab, and an unread badge for every awaiting state would compete
 * with the streaming-complete signal.
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
    if (isPending && !wasPendingPermissionRef.current && document.hidden) {
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
    if (isPending && !wasPendingPlanRef.current && document.hidden) {
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
    if (isPending && !wasPendingUserAnswerRef.current && document.hidden) {
      notify(
        NotificationKind.AWAITING_USER_INPUT,
        { sessionTitle: sessionTitleRef.current },
        soundSelectionRef.current,
      );
    }
    wasPendingUserAnswerRef.current = isPending;
  }, [signals.pendingUserAnswer]);
}
