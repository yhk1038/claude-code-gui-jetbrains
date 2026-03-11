import { getAdapter } from '@/adapters';
import { StaticItem } from '../../types';
import { Route, routeToPath, withWorkingDir } from '@/router/routes';

export const settingsItems = [
  new StaticItem('switch-account', 'Switch account', {
    disabled: false,
    action: async () => {
      window.history.pushState({}, '', withWorkingDir(routeToPath(Route.SWITCH_ACCOUNT)));
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
  }),
  new StaticItem('general-config', 'General config...', {
    disabled: false,
    action: async () => {
      await getAdapter().openSettings();
    },
  }),
];
