import { StaticItem } from '../../types';
import { i18n } from '@/i18n';

export const OPEN_ACCOUNT_USAGE_EVENT = 'open-account-usage';

export const createAccountUsageItem = (): StaticItem =>
  new StaticItem('account-usage', i18n.t('commandPalette:model.accountUsage'), {
    disabled: false,
    action: async () => {
      window.dispatchEvent(new CustomEvent(OPEN_ACCOUNT_USAGE_EVENT));
    },
  });
