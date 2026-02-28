import { StaticItem } from '../../types';

export const OPEN_ACCOUNT_USAGE_EVENT = 'open-account-usage';

export const modelItems = [
  new StaticItem('switch-model', 'Switch model...'),
  new StaticItem('account-usage', 'Account & usage...', {
    disabled: false,
    action: async () => {
      window.dispatchEvent(new CustomEvent(OPEN_ACCOUNT_USAGE_EVENT));
    },
  }),
];
