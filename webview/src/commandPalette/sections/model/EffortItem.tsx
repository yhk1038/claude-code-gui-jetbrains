import { StaticItem } from '../../types';
import { useEffort } from '@/hooks/useEffort';

export const EFFORT_CYCLE_EVENT = 'effort-cycle';

const EffortDots = () => {
  const { supportsEffort, def } = useEffort();
  if (!supportsEffort) return null;

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
