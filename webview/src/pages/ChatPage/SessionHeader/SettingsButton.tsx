import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useSessionContext } from '@/contexts/SessionContext';
import { Route } from '@/router';
import { ROUTE_META } from '@/router/routes';

export function SettingsButton() {
  const { openSettings } = useSessionContext();
  const settingsMeta = ROUTE_META[Route.SETTINGS];

  return (
    <button
      onClick={openSettings}
      className="p-1 rounded transition-colors text-text-secondary hover:text-text-primary hover:bg-surface-hover"
      title={settingsMeta.label}
    >
      <Cog6ToothIcon className="w-5 h-5" />
    </button>
  );
}
