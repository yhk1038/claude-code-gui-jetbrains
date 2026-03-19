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
        className="p-1 rounded transition-colors hover:bg-zinc-800"
        title="Remote Tunnel (Unofficial)"
      >
        <ComputerDesktopIcon
          className={`w-4 h-4 ${tunnelEnabled ? 'text-green-400' : 'text-zinc-400 hover:text-zinc-100'}`}
        />
      </button>
      {modalOpen && <TunnelModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
