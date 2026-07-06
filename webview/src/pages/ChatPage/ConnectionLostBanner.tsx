import { useEffect, useState } from 'react';
import { useBridgeContext } from '@/contexts/BridgeContext';
import { useTranslation } from '@/i18n';

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}

export function ConnectionLostBanner() {
  const { isConnected } = useBridgeContext();
  const isOnline = useOnlineStatus();
  const [dots, setDots] = useState('');
  const { t } = useTranslation('chat');

  const showBanner = !isConnected || !isOnline;

  useEffect(() => {
    if (!showBanner) return;

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(interval);
  }, [showBanner]);

  if (!showBanner) return null;

  const message = !isOnline
    ? t('connectionLost.offline', { dots })
    : t('connectionLost.reconnecting', { dots });

  return (
    <div className="w-full z-20 border-t border-b border-state-warning-border bg-state-warning-bg px-4 py-1.5 flex items-center">
      <span className="text-state-warning-fg text-[0.8461rem]">
        {message}
      </span>
    </div>
  );
}
