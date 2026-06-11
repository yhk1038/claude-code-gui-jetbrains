import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useBridgeContext } from './BridgeContext';

interface AuthContextValue {
  /** null = not yet determined; true/false = known login state. */
  loggedIn: boolean | null;
  /** Re-query the CLI auth status (e.g. after a login completes). */
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Tracks Claude CLI login state (via `claude auth status` behind GET_ACCOUNT).
 *
 * Used to (a) gate chat entry for logged-out users and (b) auto-hide the inline
 * login CTA once the user is authenticated. Re-checks on window focus so a login
 * that completes in the browser is reflected without a manual refresh.
 */
export function AuthProvider(props: AuthProviderProps) {
  const { children } = props;
  const { isConnected, send } = useBridgeContext();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  const refetch = useCallback(async () => {
    try {
      const result = await send('GET_ACCOUNT', {});
      if (result?.status === 'ok' && result.account) {
        const account = result.account as { loggedIn?: boolean };
        setLoggedIn(account.loggedIn === true);
      } else {
        // status 'error' means credentials were not found → definitively logged out.
        setLoggedIn(false);
      }
    } catch {
      // Transient failure (e.g. socket hiccup): keep the prior known state,
      // never flip a real user to "logged out" on a network blip.
    }
  }, [send]);

  useEffect(() => {
    if (isConnected) void refetch();
  }, [isConnected, refetch]);

  useEffect(() => {
    const onFocus = () => { if (isConnected) void refetch(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isConnected, refetch]);

  return (
    <AuthContext.Provider value={{ loggedIn, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
