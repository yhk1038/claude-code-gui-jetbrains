import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { reportBackendError } from '../features/telemetry';

/**
 * webview(React)의 단일 에러 바운더리가 보낸 CLIENT_ERROR를 받아 백엔드의 단일 에러
 * 보고 지점(reportBackendError)으로 넘긴다(3-layer error boundary 모델의 frontend boundary
 * → backend transport). webview는 텔레메트리를 직접 전송하지 않는다 — 전송은 백엔드 한 곳뿐.
 *
 * payload: { message, stack?, componentStack?, source? }
 *   - source: 'render' | 'window.onerror' | 'unhandledrejection' 등 어느 frontend 훅에서
 *     잡혔는지(원본 보존 — 리네이밍/필터링하지 않고 그대로 컨텍스트에 싣는다).
 */
export function clientErrorHandler(
  _connectionId: string,
  message: IPCMessage,
  _connections: ConnectionManager,
  _bridge: Bridge,
): void {
  const payload = message.payload ?? {};
  const text = typeof payload.message === 'string' ? payload.message : 'Unknown client error';
  const error = new Error(text);
  // Carry the webview's own stack rather than this handler's synthetic one.
  if (typeof payload.stack === 'string' && payload.stack.length > 0) {
    error.stack = payload.stack;
  }

  const context: Record<string, string> = { origin: 'webview', layer: 'frontend' };
  if (typeof payload.componentStack === 'string' && payload.componentStack.length > 0) {
    context.componentStack = payload.componentStack;
  }
  if (typeof payload.source === 'string' && payload.source.length > 0) {
    context.source = payload.source;
  }

  reportBackendError(error, context);
}
