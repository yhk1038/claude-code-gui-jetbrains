import { getAdapter } from '@/adapters';
import { StaticItem } from '../../types';

export const supportItems = [
  new StaticItem('help-docs', 'View help docs', {
    disabled: false,
    action: async () => {
      await getAdapter().openUrl('https://docs.anthropic.com/en/docs/claude-code/overview');
    },
  }),
];
