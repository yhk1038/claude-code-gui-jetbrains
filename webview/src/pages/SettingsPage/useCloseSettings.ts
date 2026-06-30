import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRouter } from '@/router';
import { Route } from '@/router/routes';

/**
 * Close the settings overlay, returning to the session it was opened over.
 *
 * When opened as an overlay (gear button), `location.state.backgroundLocation`
 * holds the underlying session. We navigate straight there with `replace` so the
 * WHOLE settings stack collapses at once — history-back would only step one
 * sidebar sub-route at a time and not actually hide the slot.
 *
 * When opened as a standalone tab (command palette / direct URL) there is no
 * background: fall back to a new session if there is no history to pop, else back.
 */
export function useCloseSettings(): () => void {
  const { goBack, navigate } = useRouter();
  const nav = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    const bg = location.state?.backgroundLocation;
    if (bg) {
      nav(`${bg.pathname}${bg.search}`, { replace: true });
    } else if (location.key === 'default') {
      navigate(Route.NEW_SESSION);
    } else {
      goBack();
    }
  }, [location.state, location.key, nav, navigate, goBack]);
}
