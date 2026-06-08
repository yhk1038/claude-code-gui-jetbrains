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
