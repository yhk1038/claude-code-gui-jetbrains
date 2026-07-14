/**
 * Application-wide constants.
 *
 * Single source of truth for the app name.
 */
export const APP_NAME = 'Claude Code';

/**
 * Public privacy policy URL. Locale-agnostic — the site auto-redirects to the
 * visitor's locale (e.g. /privacy → /en/privacy). Registered on the JetBrains
 * Marketplace plugin page as well (required when collecting telemetry).
 */
export const PRIVACY_POLICY_URL = 'https://claude-code-gui.com/privacy';

/**
 * Public sponsorship (pricing) page. Locale-agnostic like the privacy URL — the
 * site redirects to the visitor's locale. The backend appends the install id and
 * account context as query params (see the GET_SPONSOR_URL handler) so the
 * checkout can prefill them and the payment can be mapped back to this install;
 * this bare constant is the fallback target when that context is unavailable.
 */
export const PRICING_URL = 'https://claude-code-gui.com/pricing';
