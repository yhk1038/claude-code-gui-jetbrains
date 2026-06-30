import { SettingRow } from '../common';
import { Select, type SelectOption } from '@/components/Select';
import { useSettings } from '@/contexts/SettingsContext';
import { SettingKey, OpenSettingsMode } from '@/types/settings';

const OPEN_SETTINGS_OPTIONS: SelectOption[] = [
  { value: OpenSettingsMode.OVERLAY, label: 'Overlay' },
  { value: OpenSettingsMode.NEW_TAB, label: 'New tab' },
];

/**
 * Lets the user choose how the Settings screen opens from the gear button:
 * an overlay over the current session (keeps a running session intact) or a
 * dedicated new tab. App-global behaviour, so always written to the global scope.
 */
export function OpenSettingsRow() {
  const { settings, updateSettingWithScope } = useSettings();

  const mode = settings[SettingKey.OPEN_SETTINGS_AS] ?? OpenSettingsMode.OVERLAY;

  return (
    <SettingRow
      label="Open Settings as"
      description="Show Settings as an overlay or in a new tab."
    >
      <Select
        value={mode}
        options={OPEN_SETTINGS_OPTIONS}
        ariaLabel="Open Settings as"
        className="bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary"
        onChange={(value) => updateSettingWithScope(SettingKey.OPEN_SETTINGS_AS, value as OpenSettingsMode, 'global')}
      />
    </SettingRow>
  );
}
