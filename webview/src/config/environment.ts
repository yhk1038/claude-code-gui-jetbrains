import { IdeAdapterType } from '../adapters/IdeAdapter';

// ── 빌드 환경 ──────────────────────────────────────────
export const isDev = () => import.meta.env.DEV;
export const isProd = () => import.meta.env.PROD;

// ── 실행 환경 ──────────────────────────────────────────
export function detectRuntime(): IdeAdapterType {
  if (typeof window !== 'undefined') {
    // Legacy: window.kotlinBridge 직접 통신
    if (window.kotlinBridge) {
      return IdeAdapterType.JETBRAINS;
    }
    // v4: JCEF 환경은 URL 파라미터로 감지 (WebSocket 통신 사용)
    const params = new URLSearchParams(window.location.search);
    if (params.get('env') === 'jcef') {
      return IdeAdapterType.JETBRAINS;
    }
  }
  return IdeAdapterType.BROWSER;
}

export const isJetBrains = () => detectRuntime() === IdeAdapterType.JETBRAINS;
export const isBrowser = () => detectRuntime() === IdeAdapterType.BROWSER;
