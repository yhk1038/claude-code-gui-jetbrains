import { StaticItem } from '../../types';

export const toggleFastModeItem = new StaticItem('toggle-fast-mode', 'Toggle fast mode (Opus 4.6 only)', {
  disabled: true,
  action: async () => {
    console.log('[dummy] Toggle fast mode clicked');
  },
});
