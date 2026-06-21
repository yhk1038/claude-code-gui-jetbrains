import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { setBrowserClient } from '../features/telemetry';

/**
 * webview(브라우저)가 연결 시 알려주는 navigator.userAgent를 텔레메트리 client 식별자로 저장한다.
 * standalone(browser) 모드 전용 의미 — JetBrains 모드는 CCG_CLIENT_INFO env가 우선한다.
 */
export function clientInfoHandler(
  _connectionId: string,
  message: IPCMessage,
  _connections: ConnectionManager,
  _bridge: Bridge,
): void {
  const userAgent = message.payload?.userAgent as string | undefined;
  if (typeof userAgent === 'string' && userAgent.length > 0) {
    setBrowserClient(userAgent);
  }
}
