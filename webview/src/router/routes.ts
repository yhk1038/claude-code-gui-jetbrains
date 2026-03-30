import {
  Cog6ToothIcon,
  SwatchIcon,
  ShieldCheckIcon,
  CommandLineIcon,
  AdjustmentsHorizontalIcon,
  InformationCircleIcon,
  ChartBarSquareIcon,
  ArrowLeftIcon,
  ArrowsRightLeftIcon,
  ArrowUpCircleIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

/**
 * 아이콘 이름 enum - 모든 아이콘 참조는 이 enum 사용
 * 인라인 문자열 사용 금지
 */
export enum IconName {
  COG = 'Cog6ToothIcon',
  SWATCH = 'SwatchIcon',
  SHIELD_CHECK = 'ShieldCheckIcon',
  COMMAND_LINE = 'CommandLineIcon',
  ADJUSTMENTS = 'AdjustmentsHorizontalIcon',
  CHART_BAR_SQUARE = 'ChartBarSquareIcon',
  INFORMATION_CIRCLE = 'InformationCircleIcon',
  ARROW_LEFT = 'ArrowLeftIcon',
  ARROWS_RIGHT_LEFT = 'ArrowsRightLeftIcon',
  ARROW_UP_CIRCLE = 'ArrowUpCircleIcon',
  COMPUTER_DESKTOP = 'ComputerDesktopIcon',
}

/**
 * 애플리케이션 라우트 enum
 * 인라인 문자열 사용 금지 - 모든 경로는 이 enum으로 참조
 */
export enum Route {
  PROJECT_SELECTOR = '',
  NEW_SESSION = 'sessions/new',
  SESSION = 'sessions/:current_session_id',
  SETTINGS = 'settings',
  SETTINGS_GENERAL = 'settings/general',
  SETTINGS_APPEARANCE = 'settings/appearance',
  SETTINGS_PERMISSIONS = 'settings/permissions',
  SETTINGS_CLI = 'settings/cli',
  SETTINGS_ADVANCED = 'settings/advanced',
  SETTINGS_TUNNEL = 'settings/tunnel',
  SETTINGS_USAGE = 'settings/usage',
  SETTINGS_RELEASES = 'settings/releases',
  SETTINGS_ACCOUNT = 'settings/account',
  SETTINGS_ABOUT = 'settings/about',
  SWITCH_ACCOUNT = 'switch-account',
}

export interface RouteMeta {
  path: string;
  label: string;
  icon: IconName | null;
  description?: string;
  scopeSupport?: 'both' | 'none';
}

/**
 * 라우트별 통합 메타데이터
 */
export const ROUTE_META: Record<Route, RouteMeta> = {
  [Route.PROJECT_SELECTOR]: {
    path: '/',
    label: 'Select Project',
    icon: null,
  },
  [Route.NEW_SESSION]: {
    path: '/sessions/new',
    label: 'New Session',
    icon: null
  },
  [Route.SESSION]: {
    path: '/sessions/:current_session_id',
    label: 'Session',
    icon: null
  },
  [Route.SWITCH_ACCOUNT]: {
    path: '/switch-account',
    label: 'Switch account',
    icon: IconName.ARROWS_RIGHT_LEFT,
    description: 'Choose authentication method',
  },
  [Route.SETTINGS]: {
    path: '/settings',
    label: 'Settings',
    icon: IconName.COG
  },
  [Route.SETTINGS_GENERAL]: {
    path: '/settings/general',
    label: 'General',
    icon: IconName.COG,
    description: 'General settings',
    scopeSupport: 'both',
  },
  [Route.SETTINGS_APPEARANCE]: {
    path: '/settings/appearance',
    label: 'Appearance',
    icon: IconName.SWATCH,
    description: 'Theme and display settings',
    scopeSupport: 'both',
  },
  [Route.SETTINGS_PERMISSIONS]: {
    path: '/settings/permissions',
    label: 'Permissions',
    icon: IconName.SHIELD_CHECK,
    description: 'Tool approval settings',
    scopeSupport: 'both',
  },
  [Route.SETTINGS_CLI]: {
    path: '/settings/cli',
    label: 'CLI',
    icon: IconName.COMMAND_LINE,
    description: 'Claude CLI configuration',
    scopeSupport: 'both',
  },
  [Route.SETTINGS_ADVANCED]: {
    path: '/settings/advanced',
    label: 'Advanced',
    icon: IconName.ADJUSTMENTS,
    description: 'Debug and advanced options',
    scopeSupport: 'both',
  },
  [Route.SETTINGS_TUNNEL]: {
    path: '/settings/tunnel',
    label: 'Tunnel',
    icon: IconName.COMPUTER_DESKTOP,
    description: 'Remote tunnel and sleep prevention',
    scopeSupport: 'none',
  },
  [Route.SETTINGS_USAGE]: {
    path: '/settings/usage',
    label: 'Usage',
    icon: IconName.CHART_BAR_SQUARE,
    description: 'Plan usage limits and quota',
    scopeSupport: 'none',
  },
  [Route.SETTINGS_RELEASES]: {
    path: '/settings/releases',
    label: 'Releases',
    icon: IconName.ARROW_UP_CIRCLE,
    description: 'Release notes and updates',
    scopeSupport: 'none',
  },
  [Route.SETTINGS_ACCOUNT]: {
    path: '/settings/account',
    label: 'Account',
    icon: IconName.SHIELD_CHECK,
    description: 'Profile and authentication',
    scopeSupport: 'none',
  },
  [Route.SETTINGS_ABOUT]: {
    path: '/settings/about',
    label: 'About',
    icon: IconName.INFORMATION_CIRCLE,
    description: 'Version and information',
    scopeSupport: 'none',
  },
};

/**
 * IconName enum에서 실제 Heroicon 컴포넌트로 매핑
 */
export const ICON_COMPONENTS: Record<IconName, ComponentType<SVGProps<SVGSVGElement>>> = {
  [IconName.COG]: Cog6ToothIcon,
  [IconName.SWATCH]: SwatchIcon,
  [IconName.SHIELD_CHECK]: ShieldCheckIcon,
  [IconName.COMMAND_LINE]: CommandLineIcon,
  [IconName.ADJUSTMENTS]: AdjustmentsHorizontalIcon,
  [IconName.CHART_BAR_SQUARE]: ChartBarSquareIcon,
  [IconName.INFORMATION_CIRCLE]: InformationCircleIcon,
  [IconName.ARROW_LEFT]: ArrowLeftIcon,
  [IconName.ARROWS_RIGHT_LEFT]: ArrowsRightLeftIcon,
  [IconName.ARROW_UP_CIRCLE]: ArrowUpCircleIcon,
  [IconName.COMPUTER_DESKTOP]: ComputerDesktopIcon,
};

/**
 * pathname에서 Route enum 추출
 */
export function pathToRoute(pathname: string): Route {
  const path = pathname || '/sessions/new';

  // 동적 세션 라우트: /sessions/{id} (단, /sessions/new 제외)
  if (path.startsWith('/sessions/') && path !== '/sessions/new') {
    return Route.SESSION;
  }

  for (const [route, meta] of Object.entries(ROUTE_META)) {
    if (meta.path === path) {
      return route as Route;
    }
  }

  return Route.NEW_SESSION;
}

/**
 * pathname에서 세션 ID 추출 (동적 라우트 전용)
 * /sessions/new → null, /sessions/{id} → id
 */
export function parseSessionIdFromPath(pathname: string): string | null {
  if (pathname.startsWith('/sessions/') && pathname !== '/sessions/new') {
    return pathname.slice('/sessions/'.length) || null;
  }
  return null;
}

/**
 * 세션 ID로 path 생성
 */
export function sessionToPath(sessionId: string): string {
  return `/sessions/${sessionId}`;
}

/**
 * Route enum에서 path 생성 (정적 라우트 전용)
 * SESSION 라우트에는 sessionToPath()를 사용할 것
 */
export function routeToPath(route: Route): string {
  return ROUTE_META[route].path;
}

/**
 * 현재 URL의 workingDir 쿼리 파라미터를 보존하여 경로 생성
 * 루트 경로(/)는 프로젝트 선택 페이지이므로 workingDir를 포함하지 않음
 */
export function withWorkingDir(path: string, workingDir?: string | null): string {
  if (path === '/') return path;

  const dir = workingDir ?? new URLSearchParams(window.location.search).get('workingDir');
  if (!dir) return path;

  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}workingDir=${encodeURIComponent(dir)}`;
}

/**
 * 설정 관련 라우트인지 확인
 */
export function isSettingsRoute(route: Route): boolean {
  return route.startsWith('settings');
}

/**
 * Switch account 라우트인지 확인
 */
export function isSwitchAccountRoute(route: Route): boolean {
  return route === Route.SWITCH_ACCOUNT;
}

/**
 * 설정 서브메뉴 라우트 목록
 */
export const SETTINGS_SUB_ROUTES: Route[] = [
  Route.SETTINGS_GENERAL,
  Route.SETTINGS_APPEARANCE,
  Route.SETTINGS_PERMISSIONS,
  Route.SETTINGS_CLI,
  // Route.SETTINGS_ADVANCED,  // TODO: not yet implemented
  Route.SETTINGS_ACCOUNT,
  Route.SETTINGS_TUNNEL,
  Route.SETTINGS_USAGE,
  Route.SETTINGS_RELEASES,
  Route.SETTINGS_ABOUT,
];

/**
 * UI 라벨 enum - 모든 UI 텍스트 라벨 참조는 이 enum 사용
 * 인라인 문자열 사용 금지
 */
export enum Label {
  SETTINGS = 'Settings',
  BACK = 'Back',
  NEW_TAB = 'Open New Tab',
}
