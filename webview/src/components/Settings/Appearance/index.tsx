import { SettingSection, SettingRow } from '../common';
import { useSettings } from '@/contexts/SettingsContext';
import { SettingKey, ThemeMode } from '@/types/settings';
import { ROUTE_META, Route } from '@/router/routes';

export function AppearanceSettings() {
  const { settings, updateSetting } = useSettings();
  const meta = ROUTE_META[Route.SETTINGS_APPEARANCE];

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-6">{meta.label}</h2>

      <SettingSection title="Theme">
        <SettingRow
          label="Color Theme"
          description="Choose the color theme for the interface"
        >
          <select
            value={settings[SettingKey.THEME]}
            onChange={(e) => updateSetting(SettingKey.THEME, e.target.value as ThemeMode)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100"
          >
            <option value={ThemeMode.SYSTEM}>System</option>
            <option value={ThemeMode.LIGHT}>Light</option>
            <option value={ThemeMode.DARK}>Dark</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Font Size"
          description="Base font size for the interface"
        >
          <input
            type="number"
            min="10"
            max="20"
            value={settings[SettingKey.FONT_SIZE]}
            onChange={(e) => updateSetting(SettingKey.FONT_SIZE, parseInt(e.target.value, 10))}
            className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100"
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
}
