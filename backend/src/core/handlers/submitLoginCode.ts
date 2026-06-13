import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { submitLoginCode } from './login';

/**
 * Write the OAuth code the user pasted in the webview to the in-flight
 * `claude auth login` process. The final login result still arrives via the
 * original LOGIN request's ACK (emitted when the CLI process closes). Issue #57.
 */
export function submitLoginCodeHandler(
  connectionId: string,
  message: IPCMessage,
  _connections: ConnectionManager,
  _bridge: Bridge,
): void {
  const code = message.payload?.code as string | undefined;
  if (!code) {
    console.error('[submitLoginCode] missing code in payload');
    return;
  }
  const ok = submitLoginCode(connectionId, code);
  if (!ok) {
    console.error('[submitLoginCode] no active login process (or stdin closed) for', connectionId);
  }
}
