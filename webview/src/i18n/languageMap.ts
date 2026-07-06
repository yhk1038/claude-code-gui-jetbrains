// Bridge between two distinct concepts (see #141):
//   - the stored Claude setting value (Settings → General → Language,
//     e.g. 'english', 'korean') which primarily drives "Claude's preferred
//     response language", and
//   - the BCP-47 locale code used by i18next for the UI (e.g. 'en', 'ko').
//
// We deliberately reuse the response-language setting as the UI locale, so
// this map is the single, explicit place that translates one into the other.
// Keep the keys in sync with LANGUAGE_OPTIONS in
// pages/SettingsPage/General/index.tsx.

export const SUPPORTED_LOCALES = ['en', 'ko', 'ja', 'zh', 'es', 'fr', 'de', 'pt', 'ru'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

const LANGUAGE_TO_LOCALE: Record<string, Locale> = {
  english: 'en',
  korean: 'ko',
  japanese: 'ja',
  chinese: 'zh',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  portuguese: 'pt',
  russian: 'ru',
};

/** Resolve a stored language setting value to a UI locale. Falls back to English. */
export function toLocale(language: string | undefined | null): Locale {
  if (language && LANGUAGE_TO_LOCALE[language]) return LANGUAGE_TO_LOCALE[language];
  return DEFAULT_LOCALE;
}
