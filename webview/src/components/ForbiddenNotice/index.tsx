import { useEffect } from 'react';
import { NoSymbolIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '@/i18n';

/** Browser tab title while the hard block is shown. */
const PAGE_TITLE = '403 Forbidden';

/**
 * Standalone, opaque, full-screen "403 · Forbidden" page. Rendered by <App/> on an
 * EMPTY template (no providers / router / chat UI) whenever access is blocked —
 * either an unpaired remote device (no `?pair=` code) OR a pairing attempt that
 * did not succeed for ANY reason (expired, wrong, rate-limited, unreachable). All
 * failure modes look identical: there is no partial access.
 *
 * Sets the page title to "403 Forbidden" and strips the sensitive session path
 * from the address bar (history.replaceState → `/403`).
 */
export function ForbiddenNotice() {
  const { t } = useTranslation('common');

  useEffect(() => {
    const prevTitle = document.title;
    document.title = PAGE_TITLE;
    try {
      window.history.replaceState(window.history.state, '', '/403');
    } catch {
      // best-effort — the block screen is what matters
    }
    return () => {
      document.title = prevTitle;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 p-6 bg-surface-base text-center">
      <NoSymbolIcon className="w-12 h-12 text-state-error-fg" />
      <h1 className="text-lg font-semibold text-text-primary">{t('forbidden.title')}</h1>
      <p className="max-w-sm text-sm text-text-secondary">{t('forbidden.detail')}</p>
    </div>
  );
}
