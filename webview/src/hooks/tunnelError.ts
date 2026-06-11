// Mirrors TunnelErrorCode in the backend (backend/src/core/features/tunnel-manager.ts).
// The two packages don't share types, so keep these in sync.
export type TunnelErrorCode =
  | 'cloudflared-missing'
  | 'tunnel-timeout'
  | 'tunnel-exited'
  | 'unknown';

export interface TunnelErrorGuidance {
  title: string;
  detail: string;
  /** Shown as a copyable command when the user likely needs to install manually. */
  manualInstallCommand?: string;
  helpUrl?: string;
}

const CLOUDFLARED_DOWNLOADS_URL =
  'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/';

/**
 * Map a tunnel error code to user-facing, actionable guidance. `fallback` is the
 * raw backend message, used only when the code is unknown.
 */
export function tunnelErrorGuidance(
  code: TunnelErrorCode | null | undefined,
  fallback?: string,
): TunnelErrorGuidance {
  switch (code) {
    case 'cloudflared-missing':
      return {
        title: 'Couldn’t install cloudflared',
        detail:
          'The tunnel needs cloudflared, and it couldn’t be installed automatically. Install it manually, then try again.',
        manualInstallCommand: 'brew install cloudflared',
        helpUrl: CLOUDFLARED_DOWNLOADS_URL,
      };
    case 'tunnel-timeout':
      return {
        title: 'Tunnel connection timed out',
        detail:
          'Couldn’t reach the Cloudflare tunnel server in time. Check your network or firewall — some regions restrict access to Cloudflare.',
      };
    case 'tunnel-exited':
      return {
        title: 'cloudflared stopped unexpectedly',
        detail: 'The tunnel process exited before it was ready. Please try again.',
      };
    default:
      return {
        title: 'Couldn’t start the tunnel',
        detail: fallback || 'An unexpected error occurred. Please try again.',
      };
  }
}
