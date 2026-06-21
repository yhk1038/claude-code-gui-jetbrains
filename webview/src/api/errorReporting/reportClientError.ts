import { getBridge } from '../bridge/Bridge';

/**
 * Where in the frontend the error was caught. Sent verbatim to the backend so the
 * single backend reporting point can record which boundary fired (no renaming).
 */
export type ClientErrorSource = 'render' | 'window.onerror' | 'unhandledrejection';

interface ClientErrorContext {
  source: ClientErrorSource;
  componentStack?: string;
}

/**
 * 프론트(webview)의 단일 에러 보고 경로(3-layer error boundary 모델의 frontend boundary).
 *
 * webview는 텔레메트리를 직접 전송하지 않는다. 대신 CLIENT_ERROR IPC 메시지를 백엔드로 보내고,
 * 백엔드의 단일 보고 지점(reportBackendError)이 전송을 책임진다. 세 바운더리
 * (ErrorBoundary / StreamSafeErrorBoundary / 전역 window 훅)가 모두 이 함수만 호출한다.
 *
 * fire-and-forget: 전송 실패(미연결 등)는 삼킨다 — 에러 보고가 앱 동작에 영향을 주면 안 된다.
 */
export function reportClientError(error: unknown, context: ClientErrorContext): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const message: IPCMessage = {
      type: 'CLIENT_ERROR',
      payload: {
        message: err.message,
        stack: err.stack ?? '',
        componentStack: context.componentStack ?? '',
        source: context.source,
      },
      timestamp: Date.now(),
    };
    // sendRaw throws when the bridge is not connected yet; swallow it (next error,
    // or the backend's own boundaries, still cover us).
    getBridge().sendRaw(message);
  } catch {
    // Reporting must never affect the app — drop silently.
  }
}

/** 전역 훅 중복 등록 방지(부트스트랩에서 1회만 등록되도록). */
let globalHooksInstalled = false;

/**
 * 런타임 에러(window 'error')와 미처리 promise 거부(window 'unhandledrejection')를
 * reportClientError로 수렴시키는 전역 훅을 1회 등록한다. 앱 부트스트랩(main)에서 호출한다.
 */
export function installGlobalErrorHooks(): void {
  if (globalHooksInstalled) return;
  globalHooksInstalled = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    // event.error가 없을 수 있다(예: 크로스오리진 스크립트) — 그땐 message로 대체.
    reportClientError(event.error ?? new Error(event.message), { source: 'window.onerror' });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    reportClientError(event.reason, { source: 'unhandledrejection' });
  });
}
