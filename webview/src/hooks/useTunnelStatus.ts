import { useState, useEffect, useCallback } from 'react';
import { useBridge } from './useBridge';
import type { TunnelErrorCode } from './tunnelError';

interface TunnelStatus {
  tunnelEnabled: boolean;
  tunnelUrl: string | null;
  tunnelLoading: boolean;
  /** null until the prerequisite probe returns; false means cloudflared is missing. */
  cloudflaredAvailable: boolean | null;
  /** true when the user toggled on but cloudflared must be installed first. */
  awaitingInstallConsent: boolean;
  /** true while cloudflared is being installed after the user consented. */
  installing: boolean;
  preventSleep: boolean;
  sleepLoading: boolean;
  error: string | null;
  errorCode: TunnelErrorCode | null;
  handleTunnelToggle: (checked: boolean) => Promise<void>;
  handleSleepToggle: (checked: boolean) => Promise<void>;
  confirmInstallAndStart: () => Promise<void>;
  cancelInstall: () => void;
  retryTunnel: () => Promise<void>;
}

export function useTunnelStatus(): TunnelStatus {
  const { send, subscribe } = useBridge();

  const [tunnelEnabled, setTunnelEnabled] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [cloudflaredAvailable, setCloudflaredAvailable] = useState<boolean | null>(null);
  const [awaitingInstallConsent, setAwaitingInstallConsent] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [preventSleep, setPreventSleep] = useState(false);
  const [sleepLoading, setSleepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<TunnelErrorCode | null>(null);

  // Start the tunnel unconditionally (caller has ensured cloudflared exists).
  const startTunnelNow = useCallback(async () => {
    setTunnelLoading(true);
    try {
      const res = await send('TUNNEL_START', { port: Number(window.location.port) || 80 });
      if (res.status === 'error') {
        setError(res.error as string);
        setErrorCode('unknown');
        setTunnelLoading(false);
      }
    } catch {
      setTunnelLoading(false);
    }
  }, [send]);

  // Fetch initial status
  useEffect(() => {
    send('GET_TUNNEL_STATUS', {}).then((res) => {
      const p = res.payload ?? res;
      if (p.status === 'ok') {
        setTunnelEnabled(p.tunnel.enabled);
        setTunnelUrl(p.tunnel.url ?? null);
        setPreventSleep(p.sleepGuard.enabled);
      }
    }).catch(() => {});
  }, [send]);

  // Probe prerequisites (cloudflared availability) so the UI can warn/ask upfront
  useEffect(() => {
    send('GET_TUNNEL_PREREQS', {}).then((res) => {
      const p = res.payload ?? res;
      if (p.status === 'ok') setCloudflaredAvailable(Boolean(p.cloudflaredAvailable));
    }).catch(() => {});
  }, [send]);

  // Subscribe to broadcast updates
  useEffect(() => {
    const unsubTunnel = subscribe('TUNNEL_STATUS', (msg) => {
      const p = msg.payload as Record<string, unknown>;
      setTunnelEnabled(p.enabled as boolean);
      setTunnelUrl(p.url as string | null);
      setTunnelLoading(false);
      if (p.error) {
        setError(p.error as string);
        setErrorCode((p.errorCode as TunnelErrorCode) ?? 'unknown');
      }
    });
    const unsubInstall = subscribe('CLOUDFLARED_INSTALL_STATUS', (msg) => {
      const p = msg.payload as Record<string, unknown>;
      setInstalling(false);
      if (p.status === 'installed') {
        setCloudflaredAvailable(true);
        startTunnelNow();
      } else {
        setError((p.error as string) ?? 'Installation failed');
        setErrorCode('cloudflared-missing');
      }
    });
    const unsubSleep = subscribe('SLEEP_GUARD_STATUS', (msg) => {
      const p = msg.payload as Record<string, unknown>;
      setPreventSleep(p.enabled as boolean);
      setSleepLoading(false);
    });
    return () => { unsubTunnel(); unsubInstall(); unsubSleep(); };
  }, [subscribe, startTunnelNow]);

  const handleTunnelToggle = useCallback(async (checked: boolean) => {
    setError(null);
    setErrorCode(null);
    if (checked) {
      // Missing cloudflared → ask for install consent instead of starting.
      if (cloudflaredAvailable === false) {
        setAwaitingInstallConsent(true);
        return;
      }
      await startTunnelNow();
    } else {
      setAwaitingInstallConsent(false);
      if (preventSleep) {
        await send('SLEEP_GUARD_DISABLE', {}).catch(() => {});
      }
      await send('TUNNEL_STOP', {}).catch(() => {});
    }
  }, [cloudflaredAvailable, startTunnelNow, preventSleep, send]);

  const confirmInstallAndStart = useCallback(async () => {
    setAwaitingInstallConsent(false);
    setError(null);
    setErrorCode(null);
    setInstalling(true);
    // Outcome arrives via the CLOUDFLARED_INSTALL_STATUS broadcast, which then
    // starts the tunnel on success.
    await send('INSTALL_CLOUDFLARED', {}).catch(() => {
      setInstalling(false);
      setError('Installation failed');
      setErrorCode('cloudflared-missing');
    });
  }, [send]);

  const cancelInstall = useCallback(() => {
    setAwaitingInstallConsent(false);
  }, []);

  const handleSleepToggle = useCallback(async (checked: boolean) => {
    setError(null);
    if (checked) {
      setSleepLoading(true);
      try {
        const res = await send('SLEEP_GUARD_ENABLE', {});
        if (res.status === 'error') {
          setError(res.error as string);
          setSleepLoading(false);
        }
      } catch {
        setSleepLoading(false);
      }
    } else {
      await send('SLEEP_GUARD_DISABLE', {}).catch(() => {});
    }
  }, [send]);

  const retryTunnel = useCallback(() => handleTunnelToggle(true), [handleTunnelToggle]);

  return {
    tunnelEnabled,
    tunnelUrl,
    tunnelLoading,
    cloudflaredAvailable,
    awaitingInstallConsent,
    installing,
    preventSleep,
    sleepLoading,
    error,
    errorCode,
    handleTunnelToggle,
    handleSleepToggle,
    confirmInstallAndStart,
    cancelInstall,
    retryTunnel,
  };
}
