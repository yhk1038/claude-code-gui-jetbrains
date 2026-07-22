// webview/src/api/bridge/resolvePanelId.ts

/** sessionStorage key holding the per-tab panelId (browser/standalone mode). */
const PANEL_ID_STORAGE_KEY = 'ccg.panelId';

/**
 * Resolve a stable panelId for this webview, used to route panel-scoped backend
 * pushes (editor-context / ide-selection, NATIVE_DROP) back to the exact panel.
 *
 * Precedence:
 *   1. URL query `panelId` — JCEF embeds `?panelId=UUID` per IDE panel; this
 *      keeps the JetBrains path identical (no persistence, no generation).
 *   2. A value persisted in sessionStorage — per browser tab, survives reloads,
 *      unique across tabs. Exactly the stable, session-agnostic tab identity we
 *      want in browser/standalone mode where no URL param exists.
 *   3. A freshly generated `crypto.randomUUID()`, persisted for reload parity.
 *
 * sessionStorage access is guarded so a privacy-restricted environment still
 * returns a valid id (it just loses cross-reload stability there).
 */
export function resolvePanelId(): string {
  // (1) JCEF path — unchanged behavior.
  const fromUrl = new URLSearchParams(window.location.search).get('panelId');
  if (fromUrl) return fromUrl;

  // (2) Reuse the per-tab id persisted on a previous load.
  try {
    const stored = sessionStorage.getItem(PANEL_ID_STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // sessionStorage unavailable — fall through to generate a session-only id.
  }

  // (3) Mint and persist a stable per-tab id.
  const generated = crypto.randomUUID();
  try {
    sessionStorage.setItem(PANEL_ID_STORAGE_KEY, generated);
  } catch {
    // Persistence failed — still return a valid id for this page lifetime.
  }
  return generated;
}
