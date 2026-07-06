import { i18n } from '@/i18n';

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

const tt = (key: string) => i18n.t(`common:tunnelStatusNotice.errors.${key}`);

/**
 * Map a tunnel error code to user-facing, actionable guidance. `fallback` is the
 * raw backend message, used only when the code is unknown. Title/detail resolve
 * through i18n; the command and help URL are structural (not translated).
 */
export function tunnelErrorGuidance(
  code: TunnelErrorCode | null | undefined,
  fallback?: string,
): TunnelErrorGuidance {
  switch (code) {
    case 'cloudflared-missing':
      return {
        title: tt('cloudflaredMissing.title'),
        detail: tt('cloudflaredMissing.detail'),
        manualInstallCommand: 'brew install cloudflared',
        helpUrl: CLOUDFLARED_DOWNLOADS_URL,
      };
    case 'tunnel-timeout':
      return {
        title: tt('timeout.title'),
        detail: tt('timeout.detail'),
      };
    case 'tunnel-exited':
      return {
        title: tt('exited.title'),
        detail: tt('exited.detail'),
      };
    default:
      return {
        title: tt('unknown.title'),
        detail: fallback || tt('unknown.detail'),
      };
  }
}
