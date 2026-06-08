import { useEffect, useRef } from 'react';
import {
  NotificationKind,
  notify,
  type SoundSelection,
} from '@/notifications';
import {
  hasUnreadFavicon,
  restoreDefaultFavicon,
  setUnreadFavicon,
} from './favicon';

/**
 * Hook to update the document title based on the current session and streaming state.
 *
 * Streaming state is communicated to the JetBrains IDE via a JCEF JS bridge
 * (`window.__notifyStreamingState`), NOT via document.title encoding
 * (Chromium normalizes tab characters in titles, breaking delimiter-based parsing).
 *
 * Also swaps the browser favicon to an unread variant when streaming ends
 * while the tab is hidden, and restores it when the tab becomes visible. In
 * the same condition, fires an OS desktop notification (no-op in JCEF, where
 * the Notification API is unavailable). When the stream ends with an error,
 * fires STREAM_ERROR instead of SESSION_COMPLETE so the user can tell at a
 * glance whether the response succeeded.
 *
 * The third argument is the user's notification-sound preference (see
 * `useNotificationSound`); the caller passes it down so this hook stays
 * decoupled from settings storage. The fourth argument is the current stream
 * error (or null) from `useChatStreamContext`.
 */
export function useDocumentTitle(
  title: string | null,
  isStreaming: boolean,
  soundSelection: SoundSelection,
  error: Error | null,
) {
  const wasStreamingRef = useRef(false);

  // Keep latest values in refs so the streaming-end effect always sees them
  // without rebinding on every render.
  const titleRef = useRef(title);
  const soundSelectionRef = useRef(soundSelection);
  const errorRef = useRef(error);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    soundSelectionRef.current = soundSelection;
  }, [soundSelection]);
  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  useEffect(() => {
    // Only push a real session title up to the IDE tab. Setting APP_NAME as a
    // fallback while the session is still loading would clobber the cached
    // tab title that the JetBrains side restores from EditorTabStateService
    // (the user would see the real title flash to "Claude Code" mid-load).
    if (title) document.title = title;
  }, [title]);

  // Notify JCEF of streaming state changes
  useEffect(() => {
    const notifyJcef = (window as unknown as Record<string, unknown>).__notifyStreamingState;
    if (typeof notifyJcef === 'function') {
      (notifyJcef as (state: string) => void)(isStreaming ? 'streaming' : 'idle');
    }
  }, [isStreaming]);

  // Detect streaming end while tab is hidden → show unread favicon + desktop notification
  useEffect(() => {
    if (!isStreaming && wasStreamingRef.current && document.hidden) {
      setUnreadFavicon();
      notify(
        errorRef.current ? NotificationKind.STREAM_ERROR : NotificationKind.SESSION_COMPLETE,
        { sessionTitle: titleRef.current },
        soundSelectionRef.current,
      );
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Restore favicon when tab becomes visible. Reads the current favicon
  // from the DOM rather than a ref so that any code path that sets the
  // unread state (e.g. useAwaitingNotifications) is correctly cleared.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden && hasUnreadFavicon()) {
        restoreDefaultFavicon();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);
}
