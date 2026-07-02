import { useState, useCallback } from 'react';
import { isFablePromoActive } from '@/types/models';

/**
 * localStorage key for the dismissed state of the Fable promo notice. Mirrors
 * the key claude.ai's web bundle uses for the same notice (issue #153 appendix),
 * so the two stay conceptually aligned.
 */
export const FABLE_NOTICE_DISMISSED_KEY = 'fable-usage-notice-dismissed';

function getDismissed(): boolean {
  try {
    return localStorage.getItem(FABLE_NOTICE_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function persistDismissed(): void {
  try {
    localStorage.setItem(FABLE_NOTICE_DISMISSED_KEY, '1');
  } catch {
    // ignore — a failed persist just means the notice may reappear next load.
  }
}

interface UseFableNoticeReturn {
  /** Whether the Fable promo notice should be shown right now. */
  visible: boolean;
  /** Dismiss the notice permanently (persisted to localStorage). */
  dismiss: () => void;
}

/**
 * Controls the one-time Fable 5 promo notice (issue #153). Shown while the promo
 * window is open (`isFablePromoActive`) and the user hasn't dismissed it; once
 * dismissed it stays hidden across reloads. Past the promo window it never
 * shows, so no cleanup is needed when Fable's launch period ends.
 */
export function useFableNotice(): UseFableNoticeReturn {
  const [dismissed, setDismissed] = useState(getDismissed);
  const visible = isFablePromoActive(new Date()) && !dismissed;

  const dismiss = useCallback(() => {
    persistDismissed();
    setDismissed(true);
  }, []);

  return { visible, dismiss };
}
