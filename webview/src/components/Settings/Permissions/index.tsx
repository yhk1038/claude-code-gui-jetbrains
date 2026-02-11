import { SettingSection, SettingRow } from '../common';
import { useSettings } from '@/contexts/SettingsContext';
import { SettingKey, PermissionMode } from '@/types/settings';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { ROUTE_META, Route } from '@/router/routes';

export function PermissionsSettings() {
  const { settings, updateSetting } = useSettings();
  const meta = ROUTE_META[Route.SETTINGS_PERMISSIONS];

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-6">{meta.label}</h2>

      <SettingSection title="Tool Approval">
        <SettingRow
          label="Permission Mode"
          description="How to handle tool execution requests"
        >
          <select
            value={settings[SettingKey.PERMISSION_MODE]}
            onChange={(e) => updateSetting(SettingKey.PERMISSION_MODE, e.target.value as PermissionMode)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100"
          >
            <option value={PermissionMode.ALWAYS_ASK}>Always Ask</option>
            <option value={PermissionMode.AUTO_APPROVE_SAFE}>Auto-approve Safe</option>
            <option value={PermissionMode.AUTO_APPROVE_ALL}>Auto-approve All</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Auto-apply Low Risk"
          description="Automatically apply low-risk file changes"
        >
          <ToggleSwitch
            checked={settings[SettingKey.AUTO_APPLY_LOW_RISK]}
            onChange={(checked) => updateSetting(SettingKey.AUTO_APPLY_LOW_RISK, checked)}
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
}
