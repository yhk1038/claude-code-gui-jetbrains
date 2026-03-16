import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { ROUTE_META, Route } from '@/router/routes';
import { SettingSection, SettingRow } from '../common';
import { useTunnelStatus } from '@/hooks';

export function TunnelSettings() {
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

  const meta = ROUTE_META[Route.SETTINGS_TUNNEL];

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
    if (!tunnelUrl) return;
    navigator.clipboard.writeText(tunnelUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-6">{meta.label}</h2>

      <SettingSection title="Connection">
        {error && (
          <div className="py-2 px-3 text-sm text-red-400 bg-red-400/10 rounded">
            {error}
          </div>
        )}
        <SettingRow
          label="Remote Tunnel (Unofficial)"
          description="Expose your local server via cloudflared for remote access. No account required. If cloudflared is not installed, it will be downloaded automatically."
        >
          <ToggleSwitch
            checked={tunnelEnabled}
            onChange={handleTunnelToggle}
            disabled={tunnelLoading}
          />
        </SettingRow>

        {tunnelLoading && (
          <div className="py-4 border-b border-zinc-800 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Establishing tunnel connection... ({elapsedSec}s)</span>
            </div>
            <p className="text-xs text-zinc-600">This typically takes ~1 min (If installation is required, it takes about 3 mins.)</p>
          </div>
        )}

        {tunnelEnabled && tunnelUrl && (
          <div className="py-4 border-b border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-mono text-[11px] text-zinc-300 flex-1 truncate">{tunnelUrl}</span>
              <button onClick={handleCopy} className="flex-shrink-0">
                {copied
                  ? <ClipboardDocumentCheckIcon className="w-3 h-3 text-green-400" />
                  : <ClipboardDocumentIcon className="w-3 h-3 text-zinc-400 hover:text-zinc-200 cursor-pointer" />
                }
              </button>
            </div>
            <div className="flex justify-start">
              <div className="bg-white p-3 rounded-lg">
                <QRCodeSVG value={tunnelUrl} size={100} />
              </div>
            </div>
          </div>
        )}
      </SettingSection>

      <SettingSection title="Sleep Prevention">
        <SettingRow
          label="Prevent Sleep"
          description="Keep your machine awake while the tunnel is active, even with the lid closed."
        >
          <ToggleSwitch
            checked={preventSleep}
            onChange={handleSleepToggle}
            disabled={!tunnelEnabled || sleepLoading}
          />
        </SettingRow>

      </SettingSection>
    </div>
  );
}
