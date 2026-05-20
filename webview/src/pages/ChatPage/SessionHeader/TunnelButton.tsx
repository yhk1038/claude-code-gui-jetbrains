import { useState } from 'react';
import { ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { useTunnelStatus } from '@/hooks';
import { TunnelModal } from '@/components/TunnelModal';
import { getAdapter } from '@/adapters';

export function TunnelButton() {
  const { tunnelEnabled } = useTunnelStatus();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => {
            if (e.metaKey || e.ctrlKey) {
                getAdapter().openUrl(window.location.href);
            } else {
                setModalOpen(true);
            }
        }}
        className="p-1 rounded transition-colors hover:bg-surface-hover"
        title="Remote Tunnel (Unofficial)"
      >
        <ComputerDesktopIcon
          className={`w-5 h-5 ${tunnelEnabled ? 'text-state-success-fg' : 'text-text-secondary hover:text-text-primary'}`}
        />
      </button>
      {modalOpen && <TunnelModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
