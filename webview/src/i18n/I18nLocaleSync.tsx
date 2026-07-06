import { useEffect } from 'react';
import i18n from './config';
import { toLocale } from './languageMap';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';

/**
 * Keeps the active UI locale in sync with the effective "Language" setting
 * (Settings → General → Language). Renders nothing — this is the runtime
 * bridge that feeds settings.language into i18next.changeLanguage().
 */
export function I18nLocaleSync() {
  const { settings } = useClaudeSettings();
  const language = settings.language as string | undefined;

  useEffect(() => {
    const locale = toLocale(language);
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [language]);

  return null;
}
