import { SettingSection, SettingRow } from '../common';
import { useSettings } from '@/contexts/SettingsContext';
import { SettingKey, LogLevel } from '@/types/settings';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { ROUTE_META, Route } from '@/router/routes';

export function AdvancedSettings() {
  const { settings, updateSetting } = useSettings();
  const meta = ROUTE_META[Route.SETTINGS_ADVANCED];

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-6">{meta.label}</h2>

      <SettingSection title="Debugging">
        <SettingRow
          label="Debug Mode"
          description="Enable debug logging and diagnostics"
        >
          <ToggleSwitch
            checked={settings[SettingKey.DEBUG_MODE]}
            onChange={(checked) => updateSetting(SettingKey.DEBUG_MODE, checked)}
          />
        </SettingRow>

        <SettingRow
          label="Log Level"
          description="Minimum log level to display"
        >
          <select
            value={settings[SettingKey.LOG_LEVEL]}
            onChange={(e) => updateSetting(SettingKey.LOG_LEVEL, e.target.value as LogLevel)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100"
          >
            <option value={LogLevel.DEBUG}>Debug</option>
            <option value={LogLevel.INFO}>Info</option>
            <option value={LogLevel.WARN}>Warning</option>
            <option value={LogLevel.ERROR}>Error</option>
          </select>
        </SettingRow>
      </SettingSection>
    </div>
  );
}
