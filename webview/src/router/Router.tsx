import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { Route, hashToRoute, routeToHash } from './routes';

export interface RouterContextValue {
  route: Route;
  params: Record<string, string>;
  navigate: (route: Route, params?: Record<string, string>) => void;
  goBack: () => void;
}

export const RouterContext = createContext<RouterContextValue | null>(null);

interface RouterProps {
  children: ReactNode;
}

/**
 * 라우터 컴포넌트 - hash 변경을 감지하여 현재 라우트 결정
 */
export function Router({ children }: RouterProps) {
  const [route, setRoute] = useState<Route>(() => hashToRoute(window.location.hash));
  const [params, setParams] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Route[]>([Route.CHAT]);

  // hash 변경 감지
  useEffect(() => {
    const handleHashChange = () => {
      const newRoute = hashToRoute(window.location.hash);
      setRoute(newRoute);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 라우트 변경 시 히스토리에 추가
  useEffect(() => {
    setHistory((prev) => {
      if (prev[prev.length - 1] !== route) {
        return [...prev, route];
      }
      return prev;
    });
  }, [route]);

  const navigate = useCallback((newRoute: Route, newParams?: Record<string, string>) => {
    // /settings로 이동 시 /settings/general로 리다이렉트
    const targetRoute = newRoute === Route.SETTINGS ? Route.SETTINGS_GENERAL : newRoute;

    if (newParams) {
      setParams(newParams);
    }

    window.location.hash = routeToHash(targetRoute);
  }, []);

  const goBack = useCallback(() => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop(); // 현재 라우트 제거
      const previousRoute = newHistory[newHistory.length - 1] || Route.CHAT;
      setHistory(newHistory);
      window.location.hash = routeToHash(previousRoute);
    } else {
      // 히스토리가 없으면 Chat으로
      window.location.hash = routeToHash(Route.CHAT);
    }
  }, [history]);

  return (
    <RouterContext.Provider value={{ route, params, navigate, goBack }}>
      {children}
    </RouterContext.Provider>
  );
}
