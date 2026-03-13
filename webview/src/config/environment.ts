import { IdeAdapterType } from '../adapters/IdeAdapter';

// ── 빌드 환경 ──────────────────────────────────────────
export const isDev = () => import.meta.env.DEV;
export const isProd = () => import.meta.env.PROD;

// ── 실행 환경 ──────────────────────────────────────────
// 캐시: React Router 내부 네비게이션 시 URL 쿼리 파라미터(env=jcef)가 유실되므로,
// 최초 감지 결과를 캐시하여 세션 중 환경이 바뀌지 않도록 보장
let _cachedRuntime: IdeAdapterType | null = null;

export function detectRuntime(): IdeAdapterType {
  if (_cachedRuntime !== null) return _cachedRuntime;

  let result = IdeAdapterType.BROWSER;
  if (typeof window !== 'undefined') {
    // Legacy: window.kotlinBridge 직접 통신
    if (window.kotlinBridge) {
      result = IdeAdapterType.JETBRAINS;
    }
    // v4: JCEF 환경은 URL 파라미터로 감지 (WebSocket 통신 사용)
    const params = new URLSearchParams(window.location.search);
    if (params.get('env') === 'jcef') {
      result = IdeAdapterType.JETBRAINS;
    }
  }
  _cachedRuntime = result;
  return result;
}

export const isJetBrains = () => detectRuntime() === IdeAdapterType.JETBRAINS;
export const isBrowser = () => detectRuntime() === IdeAdapterType.BROWSER;

/** @internal test-only: reset cached runtime for isolation between test cases */
export function _resetRuntimeCache() {
  _cachedRuntime = null;
}
