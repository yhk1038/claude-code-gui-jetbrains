import { useContext } from 'react';
import { RouterContext } from './Router';
import { Route, isSettingsRoute } from './routes';

export interface UseRouterReturn {
  route: Route;
  params: Record<string, string>;
  navigate: (route: Route, params?: Record<string, string>) => void;
  goBack: () => void;
  isSettings: boolean;
}

/**
 * 라우터 훅 - RouterContext에서 라우팅 상태와 함수 제공
 */
export function useRouter(): UseRouterReturn {
  const context = useContext(RouterContext);

  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }

  return {
    route: context.route,
    params: context.params,
    navigate: context.navigate,
    goBack: context.goBack,
    isSettings: isSettingsRoute(context.route),
  };
}
