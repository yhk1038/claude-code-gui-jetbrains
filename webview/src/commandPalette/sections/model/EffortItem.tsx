import { StaticItem } from '../../types';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';
import { useCliConfig } from '@/contexts/CliConfigContext';
import {
  getEffortDef,
  getModelEffortConfig,
  parseEffortLevel,
} from '@/types/effort';

export const EFFORT_CYCLE_EVENT = 'effort-cycle';

const EffortDots = () => {
  const { settings } = useClaudeSettings();
  const { controlResponse } = useCliConfig();

  const { supportsEffort, levels } = getModelEffortConfig(controlResponse, settings.model);
  if (!supportsEffort) return null;

  const current = parseEffortLevel(settings.effortLevel, levels);
  const def = getEffortDef(current, levels);

  return (
    <span className="text-zinc-400 flex items-center gap-1">
      <span className="text-[16px] font-bold tracking-tighter pb-[1px] flex">
        {Array.from({ length: def.totalDots }, (_, i) => (
          <span
            key={i}
            className={i < def.filledDots ? 'text-zinc-300' : 'text-zinc-600'}
          >
            {'\u2022'}
          </span>
        ))}
      </span>
      <span className="text-[11px]">{def.label}</span>
    </span>
  );
};

export const effortItem = new StaticItem('effort', 'Effort', {
  disabled: false,
  keepOpen: true,
  valueComponent: () => <EffortDots />,
  action: async () => {
    window.dispatchEvent(new CustomEvent(EFFORT_CYCLE_EVENT));
  },
});
