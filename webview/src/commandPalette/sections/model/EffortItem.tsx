import { StaticItem } from '../../types';
import { useEffort } from '@/hooks/useEffort';
import { EffortSlider } from '@/components/EffortSlider';

export const EFFORT_CYCLE_EVENT = 'effort-cycle';

// Shown right after the "Effort" label, e.g. "(Extra high)" — matches the
// Cursor extension's labelSuffix. Hidden when the model has no effort support.
const EffortLabelSuffix = () => {
  const { supportsEffort, def } = useEffort();
  if (!supportsEffort) return null;
  return <>({def.label})</>;
};

const EffortValue = () => {
  const { supportsEffort } = useEffort();
  if (!supportsEffort) return null;
  return <EffortSlider />;
};

export const effortItem = new StaticItem('effort', 'Effort', {
  disabled: false,
  keepOpen: true,
  labelSuffix: () => <EffortLabelSuffix />,
  valueComponent: () => <EffortValue />,
  // Row click / Enter cycles to the next level; the slider handles direct
  // selection (and stops its own click from reaching this row handler).
  action: async () => {
    window.dispatchEvent(new CustomEvent(EFFORT_CYCLE_EVENT));
  },
});
