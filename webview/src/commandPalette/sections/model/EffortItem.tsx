import { StaticItem } from '../../types';

export const effortItem = new StaticItem('effort', 'Effort', {
  disabled: true,
  valueComponent: () => (
    <span className="text-zinc-400 flex items-center gap-1">
      <span className="text-[16px] font-bold tracking-tighter pb-[1px]">
        <span>•</span><span>•</span><span>•</span><span>•</span>
      </span>
      <span className="text-[11px]">Auto</span>
    </span>
  ),
  action: async () => {
    console.log('[dummy] Effort clicked');
  },
});
