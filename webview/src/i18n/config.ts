import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './languageMap';
import enSettings from './locales/en/settings.json';
import koSettings from './locales/ko/settings.json';
import jaSettings from './locales/ja/settings.json';
import zhSettings from './locales/zh/settings.json';
import esSettings from './locales/es/settings.json';
import frSettings from './locales/fr/settings.json';
import deSettings from './locales/de/settings.json';
import ptSettings from './locales/pt/settings.json';
import ruSettings from './locales/ru/settings.json';

// Namespaces mirror pages/areas. Migrating a page == adding one JSON file
// per locale and registering it here. English is always bundled so it can
// serve as the fallback for not-yet-translated keys.
export const defaultNS = 'settings';

export const resources = {
  en: { settings: enSettings },
  ko: { settings: koSettings },
  ja: { settings: jaSettings },
  zh: { settings: zhSettings },
  es: { settings: esSettings },
  fr: { settings: frSettings },
  de: { settings: deSettings },
  pt: { settings: ptSettings },
  ru: { settings: ruSettings },
} as const;

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    defaultNS,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export default i18n;
