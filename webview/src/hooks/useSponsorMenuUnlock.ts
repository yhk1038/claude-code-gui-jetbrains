import { useCallback, useEffect, useState } from 'react';

/**
 * Hidden unlock for the Settings > Sponsor menu.
 *
 * The sponsor entry ships hidden. While Lemon Squeezy is still in test mode we
 * don't want the pricing/checkout flow reachable by ordinary users, yet we do
 * need it reachable on demand — for our own testing and for the payment
 * provider's review. The unlock is a purely client-side toggle: double-clicking
 * the "About" heading flips it (see AboutSettings). It is persisted in
 * localStorage so it survives reloads.
 *
 * No server involvement — the sponsor backend already works; this only controls
 * whether the nav item is rendered. Once Lemon Squeezy goes live and we want the
 * menu shown to everyone, drop the gate in SettingsSidebar (or default this to
 * unlocked); nothing else has to change.
 *
 * Toggling writes localStorage and broadcasts a window event so any live
 * component re-reads immediately — the sidebar renders alongside the About page,
 * and the native 'storage' event only fires in *other* tabs, not the one that
 * wrote the value.
 */
export const SPONSOR_MENU_UNLOCKED_KEY = 'sponsor-menu-unlocked';
const SPONSOR_MENU_EVENT = 'sponsor-menu-unlock-changed';

function readUnlocked(): boolean {
  try {
    return localStorage.getItem(SPONSOR_MENU_UNLOCKED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeUnlocked(next: boolean): void {
  try {
    if (next) localStorage.setItem(SPONSOR_MENU_UNLOCKED_KEY, '1');
    else localStorage.removeItem(SPONSOR_MENU_UNLOCKED_KEY);
  } catch {
    // ignore — a failed persist just means the unlock won't survive a reload.
  }
}

interface UseSponsorMenuUnlockReturn {
  /** Whether the Sponsor nav item should be shown right now. */
  unlocked: boolean;
  /** Flip the unlock (persisted, and broadcast to other live components). */
  toggle: () => void;
}

/**
 * Reads the sponsor-menu unlock flag and keeps it in sync across the components
 * that care (the sidebar that renders the entry, the About page that toggles
 * it), plus across webview instances via the 'storage' event.
 */
export function useSponsorMenuUnlock(): UseSponsorMenuUnlockReturn {
  const [unlocked, setUnlocked] = useState(readUnlocked);

  useEffect(() => {
    const sync = () => setUnlocked(readUnlocked());
    window.addEventListener(SPONSOR_MENU_EVENT, sync);
    // Cross-tab/instance: honour an unlock/lock performed elsewhere.
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SPONSOR_MENU_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !readUnlocked();
    writeUnlocked(next);
    setUnlocked(next);
    window.dispatchEvent(new Event(SPONSOR_MENU_EVENT));
  }, []);

  return { unlocked, toggle };
}
