import { useEffect } from 'react';
import i18n from './config';
import { toLocale } from './languageMap';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';

/**
 * Keeps the active UI locale in sync with the "Interface Language" setting
 * (Settings → General → Interface Language), which is independent from
 * `language` (Claude's response language). Renders nothing.
 *
 * Source of truth is `settings.uiLanguage`. When it is unset the UI defaults
 * to English (toLocale falls back to DEFAULT_LOCALE) — it does NOT follow the
 * response language.
 */
export function I18nLocaleSync() {
  const { settings } = useClaudeSettings();
  const uiLanguage = settings.uiLanguage as string | undefined;

  useEffect(() => {
    const locale = toLocale(uiLanguage);
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [uiLanguage]);

  return null;
}
