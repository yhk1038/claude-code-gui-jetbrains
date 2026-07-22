import { useState } from 'react';
import { ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { useTunnelStatus, useBridge } from '@/hooks';
import { TunnelModal } from '@/components/TunnelModal';
import { getAdapter } from '@/adapters';
import { useTranslation } from '@/i18n';
import { MessageType } from '@/shared';

export function TunnelButton() {
  const { t } = useTranslation('chat');
  const { tunnelEnabled } = useTunnelStatus();
  const { send } = useBridge();
  const [modalOpen, setModalOpen] = useState(false);

  // Cmd/Ctrl+click opens the CURRENT session in the system browser. The browser
  // is a separate storage partition from JCEF, so it cannot reuse the JCEF auth
  // token — request a fresh single-use pairing code and carry it in the URL
  // (`?pair=`, never the token). The browser redeems it at POST /pair for its own
  // token; from then on that browser reuses its own stored token.
  const openInBrowser = async () => {
    // The browser is a SEPARATE client from JCEF and needs its OWN single-use
    // pair code (it can't reuse the JCEF token — separate storage partition).
    // panelId is intentionally NOT touched here: resolvePanelId already gives
    // every browser tab a unique in-memory id no matter how it was opened — that
    // is an independent concern from the #204 pairing flow.
    const target = new URL(window.location.href);
    try {
      const res = await send(MessageType.ISSUE_LOCAL_PAIRING, {});
      const p = res.payload ?? res;
      if (p.status === 'ok' && typeof p.code === 'string') {
        target.searchParams.set('pair', p.code);
      }
    } catch {
      // Fall back to opening without a code; the browser surfaces its own
      // disconnected state rather than failing silently here.
    }
    await getAdapter().openUrl(target.toString());
  };

  return (
    <>
      <button
        onClick={(e) => {
            if (e.metaKey || e.ctrlKey) {
                openInBrowser();
            } else {
                setModalOpen(true);
            }
        }}
        className="p-1 rounded transition-colors hover:bg-surface-hover"
        title={t('sessionHeader.tunnel.title')}
      >
        <ComputerDesktopIcon
          className={`w-5 h-5 ${tunnelEnabled ? 'text-state-success-fg' : 'text-text-secondary hover:text-text-primary'}`}
        />
      </button>
      {modalOpen && <TunnelModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
