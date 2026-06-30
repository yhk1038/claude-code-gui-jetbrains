import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useRouter, Route } from '@/router';
import { ROUTE_META } from '@/router/routes';
import { useLocation } from 'react-router-dom';
import { useSettings } from '@/contexts/SettingsContext';
import { useSessionContext } from '@/contexts/SessionContext';
import { SettingKey, OpenSettingsMode } from '@/types/settings';

export function SettingsButton() {
  const { navigate } = useRouter();
  const location = useLocation();
  const { settings } = useSettings();
  const { openSettings } = useSessionContext();
  const settingsMeta = ROUTE_META[Route.SETTINGS];

  // Open mode is user-configurable (General → "Open Settings as"):
  // - overlay (default): a modal over the current session, so a running session
  //   stays mounted.
  // - new-tab: the legacy dedicated editor/browser tab via getAdapter().openSettings().
  const openMode = settings[SettingKey.OPEN_SETTINGS_AS] ?? OpenSettingsMode.OVERLAY;

  const handleClick = () => {
    if (openMode === OpenSettingsMode.NEW_TAB) {
      openSettings();
    } else {
      navigate(Route.SETTINGS_GENERAL, { backgroundLocation: location });
    }
  };

  return (
    <button
      onClick={handleClick}
      className="p-1 rounded transition-colors text-text-secondary hover:text-text-primary hover:bg-surface-hover"
      title={settingsMeta.label}
    >
      <Cog6ToothIcon className="w-5 h-5" />
    </button>
  );
}
