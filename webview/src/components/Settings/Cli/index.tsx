import { SettingSection, SettingRow } from '../common';
import { useSettings } from '@/contexts/SettingsContext';
import { SettingKey } from '@/types/settings';
import { ROUTE_META, Route } from '@/router/routes';

export function CliSettings() {
  const { settings, updateSetting } = useSettings();
  const meta = ROUTE_META[Route.SETTINGS_CLI];

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-6">{meta.label}</h2>

      <SettingSection title="Claude CLI">
        <SettingRow
          label="CLI Path"
          description="Path to Claude CLI executable (leave empty for auto-detect)"
        >
          <input
            type="text"
            value={settings[SettingKey.CLI_PATH] || ''}
            onChange={(e) => updateSetting(SettingKey.CLI_PATH, e.target.value || null)}
            placeholder="Auto-detect"
            className="w-64 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500"
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
}
