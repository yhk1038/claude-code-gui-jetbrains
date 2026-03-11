import { StaticItem } from '../../types';
import { SWITCH_MODEL_EVENT } from '@/components/ModelSwitchOverlay';
import { useChatStreamContext } from '@/contexts/ChatStreamContext';
import { getModelDef } from '@/types/models';

const SwitchModelValue = () => {
  const { sessionModel } = useChatStreamContext();
  const text = sessionModel ? getModelDef(sessionModel).label : 'Default';
  return (
    <span className="text-[11px] text-zinc-400 whitespace-nowrap">
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
