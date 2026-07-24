import { ClientEnv } from '../shared';

// ── 빌드 환경 ──────────────────────────────────────────
export const isDev = () => import.meta.env.DEV;
export const isProd = () => import.meta.env.PROD;

// ── 실행 환경 ──────────────────────────────────────────
// 캐시: getOwnPropertyNames(window) 순회는 비용이 있으므로
// 최초 감지 결과를 캐시하여 세션 중 환경이 바뀌지 않도록 보장
let _cachedRuntime: ClientEnv | null = null;

export function detectRuntime(): ClientEnv {
  // JETBRAINS 확정 시 캐시 재사용 (확정적 양성 결과만 캐시)
  if (_cachedRuntime === ClientEnv.JETBRAINS) return _cachedRuntime;

  if (typeof window !== 'undefined') {
    // Signal 1: Kotlin이 onLoadStart에서 페이지 JS 실행 전에 주입하는 마커
    if (window.__JCEF__ === true) {
      _cachedRuntime = ClientEnv.JETBRAINS;
      return ClientEnv.JETBRAINS;
    }
    // Signal 2: JBCefJSQuery 등록 시 window에 cefQuery_* non-enumerable 함수가 자동 주입됨
    const hasCefQuery = Object.getOwnPropertyNames(window).some(key => key.startsWith('cefQuery_'));
    if (hasCefQuery) {
      _cachedRuntime = ClientEnv.JETBRAINS;
      return ClientEnv.JETBRAINS;
    }
  }

  // BROWSER는 캐시하지 않음 — JCEF 마커가 나중에 주입될 수 있으므로 재감지 허용
  return ClientEnv.BROWSER;
}

export const isJetBrains = () => detectRuntime() === ClientEnv.JETBRAINS;
export const isBrowser = () => detectRuntime() === ClientEnv.BROWSER;

/** @internal test-only: reset cached runtime for isolation between test cases */
export function _resetRuntimeCache() {
  _cachedRuntime = null;
}

export function isMobile(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  return /android|iphone|ipad|ipod/.test(userAgent);
}

/**
 * True when the client OS is macOS. Used to label the send-modifier as Cmd (⌘)
 * instead of Ctrl. Browser-only (no SSR): reads `navigator.platform`, falling
 * back to the user-agent string on engines that leave `platform` empty.
 */
export function isMac(): boolean {
  const platform = navigator.platform ?? '';
  if (platform) return platform.toUpperCase().includes('MAC');
  return /mac/i.test(navigator.userAgent);
}

// ── IDE 테마 ─────────────────────────────────────────
// JetBrains JCEF 환경에서만 의미 있음. Kotlin이 페이지 로드 시점에 LAF 값을
// window.__IDE_THEME__ 에 주입하고, LAF가 바뀌면 'ide-theme-changed' 이벤트를 dispatch한다.

/** Returns the IDE LAF theme hint if available, otherwise null. */
export function getIdeTheme(): 'dark' | 'light' | null {
  if (typeof window === 'undefined') return null;
  const v = window.__IDE_THEME__;
  return v === 'dark' || v === 'light' ? v : null;
}

/** Subscribe to IDE LAF changes. Returns an unsubscribe function. */
export function subscribeIdeTheme(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => { /* no-op */ };
  window.addEventListener('ide-theme-changed', cb);
  return () => window.removeEventListener('ide-theme-changed', cb);
}
