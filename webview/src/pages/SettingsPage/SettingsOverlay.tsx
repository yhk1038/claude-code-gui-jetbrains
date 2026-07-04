import { useEffect, ReactNode } from 'react';
import { Portal } from '@/components/Portal';
import { useCloseSettings } from './useCloseSettings';
import { isMobile } from '@/config/environment';

interface SettingsOverlayProps {
  children: ReactNode;
}

export function SettingsOverlay({ children }: SettingsOverlayProps) {
  const close = useCloseSettings();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [close]);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay-scrim"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            close();
          }
        }}
      >
        <div className={`w-full max-w-5xl bg-surface-base border border-border-default rounded-xl shadow-2xl overflow-hidden flex flex-col ${isMobile() ? 'h-full' : 'h-[85vh]'}`}>
          {children}
        </div>
      </div>
    </Portal>
  );
}
