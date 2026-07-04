import { useState, useCallback } from 'react';
import { isFablePromoActive, isFableSupportedCli } from '@/types/models';

/**
 * Which flavour of the Fable notice to show:
 *  - 'available': the running CLI can select Fable — the original promo card.
 *  - 'update-required': the CLI is too old (< 2.1.170) to know `--model fable`,
 *    so we nudge the user to update instead of offering a model they can't pick.
 */
export type FableNoticeVariant = 'available' | 'update-required';

/**
 * localStorage key for the dismissed state of the 'available' Fable promo notice.
 * Mirrors the key claude.ai's web bundle uses for the same notice (issue #153
 * appendix), so the two stay conceptually aligned. Kept unchanged for backward
 * compatibility with users who already dismissed it.
 */
export const FABLE_NOTICE_DISMISSED_KEY = 'fable-usage-notice-dismissed';

/**
 * localStorage key for the dismissed state of the 'update-required' notice. Kept
 * separate from the 'available' key so that, once the user updates their CLI,
 * the (previously unseen) 'available' notice can still surface even if they had
 * dismissed the update nudge.
 */
export const FABLE_UPDATE_NOTICE_DISMISSED_KEY = 'fable-update-notice-dismissed';

function dismissKeyFor(variant: FableNoticeVariant): string {
  return variant === 'available' ? FABLE_NOTICE_DISMISSED_KEY : FABLE_UPDATE_NOTICE_DISMISSED_KEY;
}

function getDismissed(variant: FableNoticeVariant): boolean {
  try {
    return localStorage.getItem(dismissKeyFor(variant)) === '1';
  } catch {
    return false;
  }
}

function persistDismissed(variant: FableNoticeVariant): void {
  try {
    localStorage.setItem(dismissKeyFor(variant), '1');
  } catch {
    // ignore — a failed persist just means the notice may reappear next load.
  }
}

interface UseFableNoticeReturn {
  /** Whether the Fable notice should be shown right now. */
  visible: boolean;
  /** Which flavour of notice to render (drives copy in FableNoticeBanner). */
  variant: FableNoticeVariant;
  /** Dismiss the current variant's notice permanently (persisted to localStorage). */
  dismiss: () => void;
}

/**
 * Controls the one-time Fable 5 notice (issue #153). Shown while the promo window
 * is open (`isFablePromoActive`) and the user hasn't dismissed the variant that
 * currently applies.
 *
 * The variant depends on the running CLI version (`cliVersion`): a CLI new enough
 * to select Fable (>= 2.1.170) gets the 'available' promo card; an older CLI gets
 * the 'update-required' nudge instead. Each variant tracks its own dismissed
 * state, so a user who dismissed the update nudge and then updates their CLI
 * still sees the 'available' card once (they've never seen it before).
 *
 * Past the promo window it never shows, so no cleanup is needed when Fable's
 * launch period ends.
 */
export function useFableNotice(cliVersion: string | null | undefined): UseFableNoticeReturn {
  const variant: FableNoticeVariant = isFableSupportedCli(cliVersion) ? 'available' : 'update-required';
  // Re-read the (variant-specific) dismissed flag on every render rather than
  // snapshotting once: the variant can flip when the user updates their CLI, and
  // each variant has its own key. `bump` re-renders after a dismiss so the fresh
  // localStorage value is picked up without a manual `dismissed` mirror.
  const [, bump] = useState(0);
  const dismissed = getDismissed(variant);
  // Default to hidden; only surface once the CLI version is known. The variant
  // (and thus which dismissed key applies) depends on cliVersion, so evaluating
  // before it resolves made the notice flash: it briefly rendered as
  // 'update-required' (a key the user never dismissed), then vanished once the
  // version arrived and the already-dismissed 'available' variant took over.
  const cliKnown = !!cliVersion;
  const visible = cliKnown && isFablePromoActive(new Date()) && !dismissed;

  const dismiss = useCallback(() => {
    persistDismissed(variant);
    bump((n) => n + 1);
  }, [variant]);

  return { visible, variant, dismiss };
}
