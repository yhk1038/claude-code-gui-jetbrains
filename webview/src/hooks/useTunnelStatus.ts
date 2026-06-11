import { useState, useEffect, useCallback } from 'react';
import { useBridge } from './useBridge';
import type { TunnelErrorCode } from './tunnelError';

interface TunnelStatus {
  tunnelEnabled: boolean;
  tunnelUrl: string | null;
  tunnelLoading: boolean;
  /** null until the prerequisite probe returns; false means cloudflared is missing. */
  cloudflaredAvailable: boolean | null;
  preventSleep: boolean;
  sleepLoading: boolean;
  error: string | null;
  errorCode: TunnelErrorCode | null;
  handleTunnelToggle: (checked: boolean) => Promise<void>;
  handleSleepToggle: (checked: boolean) => Promise<void>;
  retryTunnel: () => Promise<void>;
}

export function useTunnelStatus(): TunnelStatus {
  const { send, subscribe } = useBridge();

  const [tunnelEnabled, setTunnelEnabled] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [cloudflaredAvailable, setCloudflaredAvailable] = useState<boolean | null>(null);
  const [preventSleep, setPreventSleep] = useState(false);
  const [sleepLoading, setSleepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<TunnelErrorCode | null>(null);

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

  // Probe prerequisites (cloudflared availability) so the UI can warn upfront
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
    const unsubSleep = subscribe('SLEEP_GUARD_STATUS', (msg) => {
      const p = msg.payload as Record<string, unknown>;
      setPreventSleep(p.enabled as boolean);
      setSleepLoading(false);
    });
    return () => { unsubTunnel(); unsubSleep(); };
  }, [subscribe]);

  const handleTunnelToggle = useCallback(async (checked: boolean) => {
    setError(null);
    setErrorCode(null);
    if (checked) {
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
    } else {
      if (preventSleep) {
        await send('SLEEP_GUARD_DISABLE', {}).catch(() => {});
      }
      await send('TUNNEL_STOP', {}).catch(() => {});
    }
  }, [send, preventSleep]);

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
    preventSleep,
    sleepLoading,
    error,
    errorCode,
    handleTunnelToggle,
    handleSleepToggle,
    retryTunnel,
  };
}
