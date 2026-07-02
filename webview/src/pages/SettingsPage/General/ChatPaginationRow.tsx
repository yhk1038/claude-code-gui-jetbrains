import { SettingRow } from '../common';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { useSettings } from '@/contexts/SettingsContext';
import { SettingKey } from '@/types/settings';

/**
 * Toggles chat-history paging. On (default): the chat loads the latest page and
 * fetches older messages as you scroll up. Off: the whole conversation loads at
 * once (heavier for long sessions). App-global behaviour → written to global scope.
 */
export function ChatPaginationRow() {
  const { settings, updateSettingWithScope } = useSettings();

  const enabled = settings[SettingKey.CHAT_PAGINATION] ?? true;

  return (
    <SettingRow
      label="Paginate chat history"
      description="Load older messages as you scroll. Off loads the whole conversation at once."
    >
      <ToggleSwitch
        checked={enabled}
        onChange={(checked) => updateSettingWithScope(SettingKey.CHAT_PAGINATION, checked, 'global')}
        ariaLabel="Paginate chat history"
      />
    </SettingRow>
  );
}
