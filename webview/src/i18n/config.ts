import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './languageMap';
import enSettings from './locales/en/settings.json';

// Namespaces mirror pages/areas. Migrating a page == adding one JSON file
// per locale and registering it here. English is always bundled so it can
// serve as the fallback for not-yet-translated keys.
export const defaultNS = 'settings';

export const resources = {
  en: {
    settings: enSettings,
  },
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
