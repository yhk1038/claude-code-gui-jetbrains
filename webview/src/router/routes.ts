import {
  Cog6ToothIcon,
  SwatchIcon,
  ShieldCheckIcon,
  CommandLineIcon,
  AdjustmentsHorizontalIcon,
  InformationCircleIcon,
  ArrowLeftIcon,
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
  INFORMATION_CIRCLE = 'InformationCircleIcon',
  ARROW_LEFT = 'ArrowLeftIcon',
}

/**
 * 애플리케이션 라우트 enum
 * 인라인 문자열 사용 금지 - 모든 경로는 이 enum으로 참조
 */
export enum Route {
  CHAT = 'chat',
  SETTINGS = 'settings',
  SETTINGS_GENERAL = 'settings/general',
  SETTINGS_APPEARANCE = 'settings/appearance',
  SETTINGS_PERMISSIONS = 'settings/permissions',
  SETTINGS_CLI = 'settings/cli',
  SETTINGS_ADVANCED = 'settings/advanced',
  SETTINGS_ABOUT = 'settings/about',
}

export interface RouteMeta {
  path: string;
  label: string;
  icon: IconName | null;
  description?: string;
}

/**
 * 라우트별 통합 메타데이터
 */
export const ROUTE_META: Record<Route, RouteMeta> = {
  [Route.CHAT]: {
    path: '/',
    label: 'Chat',
    icon: null
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
    description: 'General settings'
  },
  [Route.SETTINGS_APPEARANCE]: {
    path: '/settings/appearance',
    label: 'Appearance',
    icon: IconName.SWATCH,
    description: 'Theme and display settings'
  },
  [Route.SETTINGS_PERMISSIONS]: {
    path: '/settings/permissions',
    label: 'Permissions',
    icon: IconName.SHIELD_CHECK,
    description: 'Tool approval settings'
  },
  [Route.SETTINGS_CLI]: {
    path: '/settings/cli',
    label: 'CLI',
    icon: IconName.COMMAND_LINE,
    description: 'Claude CLI configuration'
  },
  [Route.SETTINGS_ADVANCED]: {
    path: '/settings/advanced',
    label: 'Advanced',
    icon: IconName.ADJUSTMENTS,
    description: 'Debug and advanced options'
  },
  [Route.SETTINGS_ABOUT]: {
    path: '/settings/about',
    label: 'About',
    icon: IconName.INFORMATION_CIRCLE,
    description: 'Version and information'
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
  [IconName.INFORMATION_CIRCLE]: InformationCircleIcon,
  [IconName.ARROW_LEFT]: ArrowLeftIcon,
};

/**
 * hash에서 Route enum 추출
 */
export function hashToRoute(hash: string): Route {
  const path = hash.replace('#', '') || '/';

  for (const [route, meta] of Object.entries(ROUTE_META)) {
    if (meta.path === path) {
      return route as Route;
    }
  }

  // 기본값: CHAT
  return Route.CHAT;
}

/**
 * Route enum에서 hash 생성
 */
export function routeToHash(route: Route): string {
  return `#${ROUTE_META[route].path}`;
}

/**
 * 설정 관련 라우트인지 확인
 */
export function isSettingsRoute(route: Route): boolean {
  return route.startsWith('settings');
}

/**
 * 설정 서브메뉴 라우트 목록
 */
export const SETTINGS_SUB_ROUTES: Route[] = [
  Route.SETTINGS_GENERAL,
  Route.SETTINGS_APPEARANCE,
  Route.SETTINGS_PERMISSIONS,
  Route.SETTINGS_CLI,
  Route.SETTINGS_ADVANCED,
  Route.SETTINGS_ABOUT,
];

/**
 * UI 라벨 enum - 모든 UI 텍스트 라벨 참조는 이 enum 사용
 * 인라인 문자열 사용 금지
 */
export enum Label {
  SETTINGS = 'Settings',
  BACK = 'Back',
  NEW_TAB = '새 탭 열기',
}
