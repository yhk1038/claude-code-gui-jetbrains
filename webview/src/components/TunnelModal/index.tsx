import { useEffect, useState, useRef, useMemo } from 'react';
import { XMarkIcon, ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { QRCodeSVG } from 'qrcode.react';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { Portal } from '@/components/Portal';
import { useTunnelStatus } from '@/hooks';

interface Props {
  onClose: () => void;
}

export function TunnelModal(props: Props) {
  const { onClose } = props;
  const {
    tunnelEnabled,
    tunnelUrl,
    tunnelLoading,
    preventSleep,
    sleepLoading,
    error,
    handleTunnelToggle,
    handleSleepToggle,
  } = useTunnelStatus();

  const [copied, setCopied] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fullTunnelUrl = useMemo(() => {
    if (!tunnelUrl) return '';
    const params = new URLSearchParams(window.location.search);
    params.delete('env');
    const search = params.toString() ? `?${params.toString()}` : '';
    const pathname = window.location.pathname || '';
    const hash = window.location.hash || '';
    return `${tunnelUrl}${pathname}${search}${hash}`;
  }, [tunnelUrl]);

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

  useEffect(() => {
    if (tunnelLoading) {
      setElapsedSec(0);
      elapsedRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    } else {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
    }
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [tunnelLoading]);

  const handleCopy = () => {
    if (!fullTunnelUrl) return;
    navigator.clipboard.writeText(fullTunnelUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
          <h2 className="text-md font-semibold text-zinc-100">Remote Tunnel</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/10 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-4">
          {error && (
            <div className="py-2 px-3 text-sm text-red-400 bg-red-400/10 rounded">
              {error}
            </div>
          )}

          {/* Tunnel toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-200">Remote Tunnel (Unofficial)</div>
              <div className="text-xs text-zinc-500">Expose via cloudflared</div>
            </div>
            <ToggleSwitch
              checked={tunnelEnabled}
              onChange={handleTunnelToggle}
              disabled={tunnelLoading}
            />
          </div>

          {/* Loading indicator */}
          {tunnelLoading && (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Connecting... ({elapsedSec}s)</span>
              </div>
              <p className="text-xs text-zinc-600">Typically ~1 min (install: ~3 min)</p>
            </div>
          )}

          {/* URL + QR */}
          {tunnelEnabled && fullTunnelUrl && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-zinc-300 flex-1 truncate">{fullTunnelUrl}</span>
                <button onClick={handleCopy} className="flex-shrink-0">
                  {copied
                    ? <ClipboardDocumentCheckIcon className="w-3 h-3 text-green-400" />
                    : <ClipboardDocumentIcon className="w-3 h-3 text-zinc-400 hover:text-zinc-200 cursor-pointer" />
                  }
                </button>
              </div>
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-lg">
                  <QRCodeSVG value={fullTunnelUrl} size={100} />
                </div>
              </div>
            </div>
          )}

          {/* Sleep prevention toggle */}
          <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
            <div>
              <div className="text-sm text-zinc-200">Prevent Sleep</div>
              <div className="text-xs text-zinc-500">Keep awake while tunnel is active</div>
            </div>
            <ToggleSwitch
              checked={preventSleep}
              onChange={handleSleepToggle}
              disabled={!tunnelEnabled || sleepLoading}
            />
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
}
