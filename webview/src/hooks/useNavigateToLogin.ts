import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Route,
  routeToPath,
  withWorkingDir,
  loginPathWithFallback,
  fallbackFromSearch,
} from '@/router/routes';

/**
 * Navigate to the login (switch-account) page, remembering the current location as
 * a `fallback` query param. Always a PUSH, so back/goBack returns to the previous
 * screen (the session the user was viewing) instead of getting stuck on login.
 *
 * The single entry point every "go to login" trigger should use — chat 401
 * auto-redirect, the inline login CTA, and the auth-error banner button — so the
 * fallback is captured consistently. (#178)
 */
export function useNavigateToLogin(): () => void {
  const nav = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    nav(loginPathWithFallback(`${location.pathname}${location.search}`));
  }, [nav, location]);
}

/**
 * Send the user forward after a login COMPLETES: to the `?fallback=` origin when
 * present, else to a new session. Always a PUSH — completing login is a forward
 * step, not a cancel, so it must not collapse the back stack (a plain history.back
 * handles the "cancel and go back" case instead).
 */
export function useLoginReturn(): () => void {
  const nav = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    const fallback = fallbackFromSearch(location.search);
    nav(fallback ?? withWorkingDir(routeToPath(Route.NEW_SESSION)));
  }, [nav, location]);
}
