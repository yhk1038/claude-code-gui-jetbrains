import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useBridgeContext } from './BridgeContext';

interface AuthContextValue {
  /** null = not yet determined; true/false = known login state. */
  loggedIn: boolean | null;
  /** Re-query the CLI auth status (e.g. after a login completes). Awaitable so
   * callers can show a spinner while the re-check is in flight. */
  refetch: () => Promise<void>;
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

  // Single-flight guard: a focus ping-pong can fire window 'focus' dozens of times
  // per second; without this, each one launches a concurrent GET_ACCOUNT, and the
  // CLI buckles under the burst and returns status='error' — which used to be read
  // as "logged out". Collapsing to one in-flight request keeps the burst harmless.
  const inFlightRef = useRef(false);

  const refetch = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const result = await send('GET_ACCOUNT', {});
      if (result?.status === 'ok' && result.account) {
        const account = result.account as { loggedIn?: boolean };
        setLoggedIn(account.loggedIn === true);
      } else {
        // status 'error' is ambiguous: it can mean credentials-not-found (truly
        // logged out) OR a transient CLI failure (e.g. concurrent invocations).
        // Never flip an already-known-logged-in user to logged out on it; only an
        // undetermined (null) state resolves to false. A real logout surfaces as a
        // status 'ok' with loggedIn:false, which the branch above handles.
        setLoggedIn((prev) => (prev === true ? true : false));
      }
    } catch {
      // Transient failure (e.g. socket hiccup): keep the prior known state.
    } finally {
      inFlightRef.current = false;
    }
  }, [send]);

  useEffect(() => {
    if (isConnected) void refetch();
  }, [isConnected, refetch]);

  useEffect(() => {
    // Debounce window-focus re-checks: coalesce a focus storm into at most one
    // re-check per second so a focus ping-pong cannot stampede GET_ACCOUNT.
    let timer: number | null = null;
    const onFocus = () => {
      if (!isConnected || timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        void refetch();
      }, 1000);
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      if (timer !== null) window.clearTimeout(timer);
    };
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
