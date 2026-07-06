import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './languageMap';

// Namespaces mirror pages/areas. Migrating a page == dropping one JSON file
// per locale under ./locales/<lng>/<namespace>.json — no edits here are needed.
// English is always bundled and used as the fallback for not-yet-translated keys.
export const defaultNS = 'settings';

// Auto-load every locale catalog. Adding a namespace or a language is just a new
// JSON file; this glob picks it up at build time.
const modules = import.meta.glob('./locales/*/*.json', { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>;

export const resources: Record<string, Record<string, Record<string, unknown>>> = {};
for (const [filePath, mod] of Object.entries(modules)) {
  const match = filePath.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/);
  if (!match) continue;
  const [, lng, ns] = match;
  (resources[lng] ??= {})[ns] = mod.default;
}

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
