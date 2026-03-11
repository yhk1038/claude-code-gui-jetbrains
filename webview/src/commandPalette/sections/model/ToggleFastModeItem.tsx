import { StaticItem } from '../../types';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';
import { useChatStreamContext } from '@/contexts/ChatStreamContext';
import { ClaudeModel } from '@/types/models';
import { ToggleSwitch } from '@/components/ToggleSwitch';

export const FAST_MODE_TOGGLE_EVENT = 'fast-mode-toggle';

function isOpusModel(sessionModel: ClaudeModel | null, settingsModel: string | null): boolean {
  if (sessionModel === ClaudeModel.OPUS) return true;
  if (sessionModel === ClaudeModel.DEFAULT || sessionModel === null) {
    return settingsModel?.includes('opus') ?? false;
  }
  return false;
}

const FastModeToggle = () => {
  const { settings, updateSetting } = useClaudeSettings();
  const { sessionModel } = useChatStreamContext();
  const isOpus = isOpusModel(sessionModel, settings.model);
  const enabled = settings.preferFastMode ?? false;

  return (
    <ToggleSwitch
      checked={enabled && isOpus}
      onChange={(value) => void updateSetting('preferFastMode', value)}
      disabled={!isOpus}
      size="small"
    />
  );
};

export const toggleFastModeItem = new StaticItem('toggle-fast-mode', 'Toggle fast mode', {
  disabled: false,
  keepOpen: true,
  valueComponent: () => <FastModeToggle />,
  action: async () => {
    window.dispatchEvent(new CustomEvent(FAST_MODE_TOGGLE_EVENT));
  },
});
