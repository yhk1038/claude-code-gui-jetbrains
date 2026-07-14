import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { readProfile } from '../features/profile';
import { MessageType } from '../../shared';

// Public sponsorship (pricing) page. Mirrors the webview's PRICING_URL constant
// (config/app.ts) — kept here too because the backend, not the webview, stamps
// the install id onto the URL so that id never has to cross into the webview.
const SPONSOR_PRICING_URL = 'https://claude-code-gui.com/pricing';

/**
 * Build the sponsorship URL the webview opens in the external browser. The
 * per-install pseudonymous id (profile.uuid) is attached here as `uid` so the
 * checkout can map a completed payment back to this install via the webhook,
 * without the webview ever seeing the raw id. The account email/name (which the
 * webview already knows) are passed through as prefill hints when present.
 */
export async function getSponsorUrlHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const profile = await readProfile();

  const email = typeof message.payload?.email === 'string' ? message.payload.email : undefined;
  const name = typeof message.payload?.name === 'string' ? message.payload.name : undefined;

  const params = new URLSearchParams();
  params.set('uid', profile.uuid);
  if (email !== undefined && email !== '') params.set('email', email);
  if (name !== undefined && name !== '') params.set('name', name);

  const url = `${SPONSOR_PRICING_URL}?${params.toString()}`;

  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    status: 'ok',
    url,
  });
}
