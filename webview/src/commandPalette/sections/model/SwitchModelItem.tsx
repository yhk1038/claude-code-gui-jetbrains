import { StaticItem } from '../../types';
import { SWITCH_MODEL_EVENT } from '@/pages/ChatPage/ModelSwitchOverlay';
import { useCliConfig } from '@/contexts/CliConfigContext';
import { useCurrentModel } from '@/hooks/useCurrentModel';
import { resolveModelInfo, withFableFallback } from '@/types/models';

const SwitchModelValue = () => {
  const { controlResponse } = useCliConfig();
  const currentModel = useCurrentModel();
  const models = withFableFallback(controlResponse?.response?.response?.models ?? [], new Date());
  const info = resolveModelInfo(models, currentModel);
  const text = info?.displayName ?? currentModel;
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
