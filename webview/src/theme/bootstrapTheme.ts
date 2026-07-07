/**
 * FOUC (Flash Of Unstyled Content) prevention for the WebView boot sequence.
 *
 * When a new JCEF editor tab opens, every stage before React mounts is white:
 *   1. JCEF native first paint (CEF default white)
 *   2. HTML loaded, CSS bundle not yet applied
 *   3. CSS bundle applied but `.dark` class not yet on <html>
 *      (SettingsContext only adds it after React mounts)
 *
 * To paint the correct surface color immediately, the inline <script> in
 * webview/index.html runs this resolution BEFORE the CSS bundle / React. It
 * reads the `theme` query param (injected by Kotlin from JBColor.isBright() via
 * the WebView URL) and falls back to prefers-color-scheme when absent.
 *
 * The inline script in index.html replicates this minimal logic verbatim (it
 * cannot import a module before the bundle loads), so this module exists to keep
 * that logic unit-tested. Keep the two in sync.
 */

import { toLocale } from '@/i18n/languageMap';

export type BootstrapTheme = 'dark' | 'light';

/**
 * Background colors used by the bootstrap script. These MUST match
 * `--surface-base` in webview/src/index.css:
 *   - light (:root) #FFFFFF
 *   - dark  (.dark) #1A1A1A
 * If those CSS tokens change, update these constants (and index.html) too.
 */
export const BOOTSTRAP_BG_DARK = '#1A1A1A';
export const BOOTSTRAP_BG_LIGHT = '#FFFFFF';

/**
 * Resolve the boot theme from the URL `theme` param with a matchMedia fallback.
 *
 * @param themeParam value of `?theme=` (e.g. 'dark' | 'light' | null | '')
 * @param prefersDark result of matchMedia('(prefers-color-scheme: dark)').matches
 */
export function resolveBootstrapTheme(
  themeParam: string | null | undefined,
  prefersDark: boolean,
): BootstrapTheme {
  if (themeParam === 'dark') return 'dark';
  if (themeParam === 'light') return 'light';
  return prefersDark ? 'dark' : 'light';
}

/**
 * FOUC prevention for UI mirroring (RTL/LTR layout direction).
 *
 * Unlike theme, direction has no Kotlin-injected URL hint — its only source of
 * truth is the `uiDirection` setting persisted by SettingsContext to
 * localStorage (key `claude-code-settings`, see STORAGE_KEY there). The inline
 * <script> in webview/index.html reads that localStorage entry directly (it
 * cannot import a module before the bundle loads) and replicates this
 * resolution logic verbatim. Keep the two in sync.
 */
export type BootstrapDirection = 'ltr' | 'rtl';

/**
 * @param storedUiDirection value of the `uiDirection` field read from the
 * `claude-code-settings` localStorage entry (or undefined/null when absent
 * or unparsable).
 */
export function resolveBootstrapDirection(
  storedUiDirection: string | null | undefined,
): BootstrapDirection {
  return storedUiDirection === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * FOUC prevention for `<html lang>` (screen-reader / a11y correctness).
 *
 * Unlike theme/direction, `uiLanguage` is owned by ClaudeSettingsContext,
 * which has no localStorage cache of its own — the only persisted source
 * before the bridge connects is the dedicated cache I18nLocaleSync writes on
 * every sync (key `claude-code-ui-language`, see UI_LANGUAGE_STORAGE_KEY in
 * i18n/I18nLocaleSync.tsx). The inline <script> in webview/index.html reads
 * that same localStorage entry directly (it cannot import a module before the
 * bundle loads) and replicates the uiLanguage → BCP-47 locale mapping
 * verbatim. Keep i18n/languageMap.ts (LANGUAGE_TO_LOCALE, the single source of
 * truth), this function, and the inline script in sync.
 *
 * @param storedUiLanguage value of the `claude-code-ui-language` localStorage
 * entry (or undefined/null when absent).
 */
export function resolveBootstrapLang(storedUiLanguage: string | null | undefined): string {
  return toLocale(storedUiLanguage);
}
