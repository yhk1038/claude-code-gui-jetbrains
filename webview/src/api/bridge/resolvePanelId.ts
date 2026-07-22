// webview/src/api/bridge/resolvePanelId.ts

import { isJetBrains } from '../../config/environment';

// Module-level in-memory panelId for the browser. Unique per JS context — a new
// tab, HOWEVER it was opened (new-tab button, Cmd+click, duplicate), is a new
// context — and stable across re-renders within one page load. A reload mints a
// new one, which is correct: a reload is a fresh connection and focus is
// re-reported.
let browserPanelId: string | null = null;

/**
 * Resolve a stable panelId identifying THIS webview panel, used to route
 * panel-scoped backend pushes (editor-context / ide-selection file badge,
 * NATIVE_DROP) back to the exact panel. panelId identity is INDEPENDENT of the
 * #204 pairing flow — every tab must get its own regardless of how it was opened.
 *
 *   - JCEF: Kotlin embeds a stable `?panelId=<uuid>` per IDE panel and re-injects
 *     it on reload, so the URL param is authoritative.
 *   - Browser: `window.open` COPIES both the opener's URL and its sessionStorage
 *     into a new tab, so NEITHER can distinguish tabs — every tab would inherit
 *     the opener's id and collide in the backend's 1:1 panelId→connection index.
 *     A module-level in-memory id is unique per JS context instead, so each
 *     browser tab gets its own no matter how it was opened.
 */
export function resolvePanelId(): string {
  if (isJetBrains()) {
    const fromUrl = new URLSearchParams(window.location.search).get('panelId');
    if (fromUrl) return fromUrl;
  }
  if (browserPanelId) return browserPanelId;
  browserPanelId = crypto.randomUUID();
  return browserPanelId;
}

/** @internal test-only: reset the in-memory browser panelId (simulates a new tab). */
export function _resetPanelIdCache(): void {
  browserPanelId = null;
}
