import { SettingSection, SettingRow } from '../common';
import { Select, type SelectOption } from '@/components/Select';
import { useSettings } from '@/contexts/SettingsContext';
import { SettingKey, HostMode } from '@/types/settings';
import { isJetBrains } from '@/config/environment';

const HOST_MODE_OPTIONS: SelectOption[] = [
  { value: HostMode.EDITOR_TAB, label: 'Editor tab' },
  { value: HostMode.TOOL_WINDOW, label: 'Tool window' },
];

/**
 * Lets the user choose where new chats open — a dedicated editor tab or the
 * Claude Code tool window. Only meaningful inside the JetBrains IDE, so it is
 * hidden in the browser (standalone) runtime.
 *
 * Host mode is an IDE-global behaviour (the Kotlin SettingsManager reads it from
 * the global settings file only), so it is always written to the global scope
 * regardless of the active settings scope tab.
 */
export function HostModeSection() {
  const { settings, updateSettingWithScope } = useSettings();

  if (!isJetBrains()) return null;

  const hostMode = settings[SettingKey.HOST_MODE] ?? HostMode.EDITOR_TAB;

  return (
    <SettingSection title="Chat Location">
      <SettingRow
        label="Open chats in"
        description="Where new Claude Code chats open. Applies to chats you open next; already-open chats stay where they are."
      >
        <Select
          value={hostMode}
          options={HOST_MODE_OPTIONS}
          ariaLabel="Open chats in"
          className="bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary"
          onChange={(value) => updateSettingWithScope(SettingKey.HOST_MODE, value as HostMode, 'global')}
        />
      </SettingRow>
    </SettingSection>
  );
}
