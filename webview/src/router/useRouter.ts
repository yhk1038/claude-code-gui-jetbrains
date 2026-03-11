import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Route, pathToRoute, routeToPath, isSettingsRoute, sessionToPath, withWorkingDir } from './routes';

export interface UseRouterReturn {
  route: Route;
  params: Record<string, string>;
  navigate: (route: Route, params?: Record<string, string>) => void;
  navigateToSession: (sessionId: string) => void;
  goBack: () => void;
  isSettings: boolean;
}

/**
 * 라우터 훅 - react-router의 useNavigate, useLocation, useParams를 감싸는 래퍼
 */
export function useRouter(): UseRouterReturn {
  const nav = useNavigate();
  const location = useLocation();
  const routeParams = useParams();
  const route = pathToRoute(location.pathname);

  const navigate = (targetRoute: Route, _params?: Record<string, string>) => {
    const resolved = targetRoute === Route.SETTINGS ? Route.SETTINGS_GENERAL : targetRoute;
    nav(withWorkingDir(routeToPath(resolved)));
  };

  const navigateToSession = (sessionId: string) => {
    nav(withWorkingDir(sessionToPath(sessionId)));
  };

  const goBack = () => {
    nav(-1);
  };

  return {
    route,
    params: routeParams as Record<string, string>,
    navigate,
    navigateToSession,
    goBack,
    isSettings: isSettingsRoute(route),
  };
}
