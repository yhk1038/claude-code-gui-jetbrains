import { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Portal } from '@/components/Portal';
import { useAccountData } from './useAccountData';
import { SectionLabel } from './SectionLabel';
import { InfoRow, InfoRowSkeleton } from './InfoRow';
import { UsageSection } from "./UsageSection";

interface AccountUsageModalProps {
  onClose: () => void;
}

export function AccountUsageModal({ onClose }: AccountUsageModalProps) {
  const { data: accountData, isLoading: accountLoading } = useAccountData();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <Portal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-md font-semibold text-zinc-100">Account &amp; Usage</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/10 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* ACCOUNT section */}
          <div>
            <SectionLabel>Account</SectionLabel>
            {accountLoading && !accountData ? (
              <>
                <InfoRowSkeleton />
                <InfoRowSkeleton />
                <InfoRowSkeleton />
              </>
            ) : (
              <>
                <InfoRow label="Auth method" value={accountData?.authMethod ?? null} />
                <InfoRow label="Email" value={accountData?.email ?? null} />
                <InfoRow label="Plan" value={accountData?.plan ?? null} />
              </>
            )}
          </div>

          {/* USAGE section */}
          <UsageSection />
        </div>
      </div>
    </div>
    </Portal>
  );
}
