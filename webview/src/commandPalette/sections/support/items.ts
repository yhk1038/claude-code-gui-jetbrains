import { getAdapter } from '@/adapters';
import { StaticItem } from '../../types';

export const supportItems = [
  new StaticItem('help-docs', 'View help docs', {
    disabled: false,
    action: async () => {
      await getAdapter().openUrl('https://docs.anthropic.com/en/docs/claude-code/overview');
    },
  }),
  new StaticItem('restart-plugin', 'Restart plugin', {
    disabled: false,
    serviceAction: async (services) => {
      const ok = await services.ui.confirm({
        title: 'Restart plugin?',
        message: 'In-progress work will be interrupted.',
        confirmLabel: 'Restart',
        variant: 'danger',
      });
      if (ok) await getAdapter().restartBackend();
    },
  }),
];
