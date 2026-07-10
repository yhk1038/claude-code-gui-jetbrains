import { i18n } from '@/i18n';

/**
 * The English text of an i18n key, for use as a search keyword. Built-in
 * palette items are shown in the user's language, but users often search by
 * the English spelling (matching the CLI). Adding the English label as a
 * keyword lets e.g. "model" match the translated "모델 전환" item — without
 * touching the displayed translation. English is always bundled (see
 * i18n/config.ts), so this resolves regardless of the active locale.
 */
export function enKeyword(key: string): string {
  return i18n.t(key, { lng: 'en' });
}
