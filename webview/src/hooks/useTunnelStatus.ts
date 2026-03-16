import { useState, useEffect, useCallback } from 'react';
import { useBridge } from './useBridge';

interface TunnelStatus {
  tunnelEnabled: boolean;
  tunnelUrl: string | null;
  tunnelLoading: boolean;
  preventSleep: boolean;
  sleepLoading: boolean;
  error: string | null;
  handleTunnelToggle: (checked: boolean) => Promise<void>;
  handleSleepToggle: (checked: boolean) => Promise<void>;
}

export function useTunnelStatus(): TunnelStatus {
  const { send, subscribe } = useBridge();

  const [tunnelEnabled, setTunnelEnabled] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [preventSleep, setPreventSleep] = useState(false);
  const [sleepLoading, setSleepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Subscribe to broadcast updates
  useEffect(() => {
    const unsubTunnel = subscribe('TUNNEL_STATUS', (msg) => {
      const p = msg.payload as Record<string, unknown>;
      setTunnelEnabled(p.enabled as boolean);
      setTunnelUrl(p.url as string | null);
      setTunnelLoading(false);
      if (p.error) {
        setError(p.error as string);
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
    if (checked) {
      setTunnelLoading(true);
      try {
        const res = await send('TUNNEL_START', { port: Number(window.location.port) || 80 });
        if (res.status === 'error') {
          setError(res.error as string);
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

  return {
    tunnelEnabled,
    tunnelUrl,
    tunnelLoading,
    preventSleep,
    sleepLoading,
    error,
    handleTunnelToggle,
    handleSleepToggle,
  };
}
