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
      className="p-1 rounded transition-colors text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
      title={settingsMeta.label}
    >
      <Cog6ToothIcon className="w-4 h-4" />
    </button>
  );
}
