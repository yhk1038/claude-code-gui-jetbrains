import { StaticItem } from '../../types';
import { SWITCH_MODEL_EVENT } from '@/pages/ChatPage/ModelSwitchOverlay';
import { useChatStreamContext } from '@/contexts/ChatStreamContext';
import { useCliConfig } from '@/contexts/CliConfigContext';
import { resolveModelInfo } from '@/types/models';

const SwitchModelValue = () => {
  const { sessionModel } = useChatStreamContext();
  const { controlResponse } = useCliConfig();
  const models = controlResponse?.response?.response?.models ?? [];
  const info = resolveModelInfo(models, sessionModel);
  const text = info?.displayName ?? (sessionModel ?? 'Default');
  return (
    <span className="text-[0.8461rem] text-text-secondary whitespace-nowrap">
      {text}
    </span>
  );
};

export const switchModelItem = new StaticItem('switch-model', 'Switch model...', {
  disabled: false,
  valueComponent: () => <SwitchModelValue />,
  action: async () => {
    window.dispatchEvent(new CustomEvent(SWITCH_MODEL_EVENT));
  },
});
