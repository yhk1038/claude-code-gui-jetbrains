import { useEffect } from 'react';
import { useRouter } from '@/router';
import { Route } from '@/router/routes';
import { useAuthContext } from '@/contexts';

/**
 * Redirects to the login (switch-account) page when the user is definitively
 * logged out. Call from the chat entry point so a logged-out user lands on the
 * login screen instead of a chat that fails on the first message.
 *
 * Only redirects on a known-false state — an undetermined (null) state, e.g.
 * while `claude auth status` is still resolving, leaves the user where they are.
 */
export function useLoginGate(): void {
  const { loggedIn } = useAuthContext();
  const { navigate } = useRouter();

  useEffect(() => {
    if (loggedIn === false) {
      navigate(Route.SWITCH_ACCOUNT);
    }
  }, [loggedIn, navigate]);
}
