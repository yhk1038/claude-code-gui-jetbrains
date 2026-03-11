import { StaticToggleItem } from '../../types';

export const thinkingItem = new StaticToggleItem('thinking', 'Thinking', {
  disabled: true,
  toggled: true,
  valueComponent: () => (
    <span className="text-[11px] text-zinc-400 whitespace-nowrap">
      {/*Effort: Auto*/}
    </span>
  ),
  onToggle: (value: boolean) => {
    console.log('[dummy] Thinking toggled:', value);
  },
});
