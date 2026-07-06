import { StaticItem } from '../../types';
import { i18n } from '@/i18n';
import { useEffort } from '@/hooks/useEffort';
import { EffortSlider } from '@/components/EffortSlider';

export const EFFORT_CYCLE_EVENT = 'effort-cycle';

/**
 * Reason shown as a hover tooltip when the row is disabled (model doesn't
 * support effort levels). A function so the lookup runs on the current locale
 * at call time, not at module load.
 */
export const getEffortUnsupportedReason = (): string =>
  i18n.t('commandPalette:model.effortUnsupportedReason');

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

export const createEffortItem = (): StaticItem =>
  new StaticItem('effort', i18n.t('commandPalette:model.effort'), {
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
