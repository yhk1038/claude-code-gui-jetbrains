import { useEffect } from 'react';
import i18n from './config';
import { toLocale } from './languageMap';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';

/**
 * Keeps the active UI locale in sync with the "Interface Language" setting
 * (Settings → General → Interface Language), which is independent from
 * `language` (Claude's response language). Renders nothing.
 *
 * Source of truth is `settings.uiLanguage`. When it is unset we fall back to
 * `settings.language` so existing users keep the language they already had,
 * then to English — but once the user picks an interface language it wins.
 */
export function I18nLocaleSync() {
  const { settings } = useClaudeSettings();
  const uiLanguage = settings.uiLanguage as string | undefined;
  const responseLanguage = settings.language as string | undefined;
  const effective = uiLanguage ?? responseLanguage;

  useEffect(() => {
    const locale = toLocale(effective);
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [effective]);

  return null;
}
