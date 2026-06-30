import { useNavigate, useLocation, useParams, Location } from 'react-router-dom';
import { Route, pathToRoute, routeToPath, isSettingsRoute, withWorkingDir } from './routes';

export interface UseRouterReturn {
  route: Route;
  params: Record<string, string>;
  navigate: (route: Route, options?: { backgroundLocation?: Location }) => void;
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

  const navigate = (targetRoute: Route, options?: { backgroundLocation?: Location }) => {
    const resolved = targetRoute === Route.SETTINGS ? Route.SETTINGS_GENERAL : targetRoute;
    const path = withWorkingDir(routeToPath(resolved));
    const carried = options?.backgroundLocation
      ?? (isSettingsRoute(resolved) ? location.state?.backgroundLocation : undefined);
    nav(path, carried ? { state: { backgroundLocation: carried } } : undefined);
  };

  const goBack = () => {
    nav(-1);
  };

  return {
    route,
    params: routeParams as Record<string, string>,
    navigate,
    goBack,
    isSettings: isSettingsRoute(route),
  };
}
