import { useEffect } from 'react';
import { getBridge } from '@/api/bridge/Bridge';
import { resolvePanelId } from '@/api/bridge/resolvePanelId';
import { MessageType } from '@/shared';

/**
 * Report this webview's panel as the last-focused one so the backend routes
 * panel-scoped pushes (editor-context / ide-selection file badge) to only this
 * panel instead of broadcasting to every open Claude panel sharing a workingDir.
 *
 * Fire-and-forget over `sendRaw`: the backend does not ACK PANEL_FOCUSED, so a
 * request/response send would just time out. A pre-connect send throws and is
 * swallowed — the connection-ready re-report below (and any later focus event)
 * covers a panel that opened already-focused before the socket was open.
 *
 * Mounted once at the app level; cleans up its listeners on unmount.
 */
export function usePanelFocusReporter(): void {
  useEffect(() => {
    const bridge = getBridge();
    const panelId = resolvePanelId();

    const report = () => {
      try {
        bridge.sendRaw({
          type: MessageType.PANEL_FOCUSED,
          payload: { panelId },
          timestamp: Date.now(),
        });
      } catch {
        // Socket not open yet — a later focus event or the connection-ready
        // handler re-reports. Losing one pre-connect ping is harmless.
      }
    };

    const onFocus = () => report();
    window.addEventListener('focus', onFocus);

    // Re-assert focus on (re)connect while focused so a panel that opened
    // already-focused before the socket was ready still registers, and a
    // reconnect re-establishes which panel is active.
    const unsubscribe = bridge.onConnectionChange((connected) => {
      if (connected && document.hasFocus()) report();
    });

    // A panel that opens already-focused registers immediately.
    if (document.hasFocus()) report();

    return () => {
      window.removeEventListener('focus', onFocus);
      unsubscribe();
    };
  }, []);
}
