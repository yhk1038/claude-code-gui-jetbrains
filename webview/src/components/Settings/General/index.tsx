import { SettingSection, SettingRow } from '../common';
import { ROUTE_META, Route } from '@/router/routes';
import { useSettings } from '@/contexts/SettingsContext';
import { SettingKey } from '@/types/settings';
import { type InputMode, INPUT_MODES, MODE_CYCLE } from '@/types/chatInput';

export function GeneralSettings() {
  const meta = ROUTE_META[Route.SETTINGS_GENERAL];
  const { settings, updateSetting } = useSettings();

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-6">{meta.label}</h2>

      <SettingSection title="Application">
        <SettingRow
          label="Language"
          description="Interface language (restart required)"
        >
          <select
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100"
            defaultValue="en"
          >
            <option value="en">English</option>
            <option value="ko">한국어</option>
          </select>
        </SettingRow>
      </SettingSection>

      <SettingSection title="Chat Input">
        <SettingRow
          label="Default Input Mode"
          description="Initial mode when opening a new chat session"
        >
          <select
            value={settings[SettingKey.INITIAL_INPUT_MODE]}
            onChange={(e) => updateSetting(SettingKey.INITIAL_INPUT_MODE, e.target.value as InputMode)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100"
          >
            {MODE_CYCLE.map((modeId) => (
              <option key={modeId} value={modeId}>
                {INPUT_MODES[modeId].label}
              </option>
            ))}
          </select>
        </SettingRow>
      </SettingSection>
    </div>
  );
}
