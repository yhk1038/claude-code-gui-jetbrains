import {IdeAdapterType} from '../adapters/IdeAdapter';

// ── 빌드 환경 ──────────────────────────────────────────
export const isDev = () => import.meta.env.DEV;
export const isProd = () => import.meta.env.PROD;

// ── 실행 환경 ──────────────────────────────────────────
// 캐시: getOwnPropertyNames(window) 순회는 비용이 있으므로
// 최초 감지 결과를 캐시하여 세션 중 환경이 바뀌지 않도록 보장
let _cachedRuntime: IdeAdapterType | null = null;

export function detectRuntime(): IdeAdapterType {
  // JETBRAINS 확정 시 캐시 재사용 (확정적 양성 결과만 캐시)
  if (_cachedRuntime === IdeAdapterType.JETBRAINS) return _cachedRuntime;

  if (typeof window !== 'undefined') {
    // Signal 1: Kotlin이 onLoadStart에서 페이지 JS 실행 전에 주입하는 마커
    if (window.__JCEF__ === true) {
      _cachedRuntime = IdeAdapterType.JETBRAINS;
      return IdeAdapterType.JETBRAINS;
    }
    // Signal 2: JBCefJSQuery 등록 시 window에 cefQuery_* non-enumerable 함수가 자동 주입됨
    const hasCefQuery = Object.getOwnPropertyNames(window).some(key => key.startsWith('cefQuery_'));
    if (hasCefQuery) {
      _cachedRuntime = IdeAdapterType.JETBRAINS;
      return IdeAdapterType.JETBRAINS;
    }
  }

  // BROWSER는 캐시하지 않음 — JCEF 마커가 나중에 주입될 수 있으므로 재감지 허용
  return IdeAdapterType.BROWSER;
}

export const isJetBrains = () => detectRuntime() === IdeAdapterType.JETBRAINS;
export const isBrowser = () => detectRuntime() === IdeAdapterType.BROWSER;

/** @internal test-only: reset cached runtime for isolation between test cases */
export function _resetRuntimeCache() {
  _cachedRuntime = null;
}

export function isMobile(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  return /android|iphone|ipad|ipod/.test(userAgent);
}
