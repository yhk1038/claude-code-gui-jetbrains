import { api } from '@/api/ClaudeCodeApi';
import { NOTIFICATION_TEMPLATES } from './templates';
import {
  NotificationKind,
  SOUND_OFF,
  type NotificationContext,
  type SoundSelection,
} from './types';

/**
 * Emits a desktop notification for the given event kind.
 *
 * Silently no-ops in environments where the Notification API is unavailable
 * (e.g. JCEF inside the JetBrains IDE) or when permission has not been
 * granted yet, so callers can invoke it unconditionally.
 *
 * As of Phase 1.5 the notification itself is always created with
 * `silent: true` — sound playback is delegated to the Node.js backend via
 * `PLAY_SYSTEM_SOUND` so we can play a specific OS sound consistently
 * across browsers (the browser `silent: false` path is too unreliable on
 * Chrome/macOS). When `soundSelection !== SOUND_OFF`, the selected
 * `soundId` is sent to the backend in fire-and-forget fashion.
 */

const activeNotifications = new Set<Notification>();

export function notify(
  kind: NotificationKind,
  ctx: NotificationContext,
  soundSelection: SoundSelection,
): void {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const template = NOTIFICATION_TEMPLATES[kind];

  let n: Notification;
  try {
    n = new Notification(template.title(ctx), {
      body: template.body(),
      icon: template.icon,
      // Always silence the browser's own sound channel — sound is played by
      // the backend (Phase 1.5) so we don't double up.
      silent: true,
    });
  } catch {
    // Some platforms (e.g. some mobile Safari versions) throw when constructing
    // a Notification directly. Treat construction failure as a no-op.
    return;
  }

  if (soundSelection !== SOUND_OFF) {
    api.sounds.play(soundSelection).catch((err: unknown) => {
      // Sound playback is best-effort; do not propagate failure to the caller.
      console.warn('[notify] PLAY_SYSTEM_SOUND failed:', err);
    });
  }

  activeNotifications.add(n);
  n.onclick = () => {
    window.focus();
    n.close();
  };
  n.onclose = () => {
    activeNotifications.delete(n);
  };
}

if (typeof window !== 'undefined' && 'addEventListener' in window) {
  window.addEventListener('beforeunload', () => {
    activeNotifications.forEach((n) => n.close());
    activeNotifications.clear();
  });
}
