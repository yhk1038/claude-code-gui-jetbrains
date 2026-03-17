import {IdeAdapterType} from '../adapters/IdeAdapter';

// ── 빌드 환경 ──────────────────────────────────────────
export const isDev = () => import.meta.env.DEV;
export const isProd = () => import.meta.env.PROD;

// ── 실행 환경 ──────────────────────────────────────────
// 캐시: getOwnPropertyNames(window) 순회는 비용이 있으므로
// 최초 감지 결과를 캐시하여 세션 중 환경이 바뀌지 않도록 보장
let _cachedRuntime: IdeAdapterType | null = null;

export function detectRuntime(): IdeAdapterType {
  if (_cachedRuntime) return _cachedRuntime;

  let result = IdeAdapterType.BROWSER;
  if (typeof window !== 'undefined') {
    // JCEF 환경: JBCefJSQuery 등록 시 window에 cefQuery_* non-enumerable 함수가 자동 주입됨
    // Object.keys()는 non-enumerable을 포함하지 않으므로 getOwnPropertyNames() 사용
    const isJcef = Object.getOwnPropertyNames(window).some(key => key.startsWith('cefQuery_'));
    result = isJcef ? IdeAdapterType.JETBRAINS : IdeAdapterType.BROWSER;
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
