export { default as i18n } from './config';
export { toLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES } from './languageMap';
export type { Locale } from './languageMap';
export { useTranslation, Trans } from 'react-i18next';

// Note: I18nLocaleSync is intentionally NOT re-exported here. It depends on the
// app's ClaudeSettings/Bridge contexts, and pulling that chain into every module
// that only needs `useTranslation` breaks test isolation (Bridge mocks) and import
// hygiene. Import it directly from '@/i18n/I18nLocaleSync' where needed (App only).
