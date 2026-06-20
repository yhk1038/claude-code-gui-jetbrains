import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { setTelemetryConsent, readProfile } from '../features/profile';
import { trackEvent } from '../features/telemetry';
import { getPluginVersion } from './getVersion';

/**
 * 텔레메트리 수락(accept)/거부(deny)를 profile.json에 기록하고, 'telemetry_consent'
 * 이벤트를 전송한다.
 *
 * 전송 순서가 중요하다 — telemetry는 ACCEPTED 상태에서만 전송되므로:
 * - accept: 저장(ACCEPTED) 후 전송 → 게이팅 통과
 * - deny: **저장 전** 전송. 클릭 시점이 ACCEPTED(=철회)면 전송되고, PENDING(=최초 거부)이면
 *   게이팅에 막혀 자연히 전송되지 않는다(거부는 비동의 전송 회피).
 */
export async function setTelemetryConsentHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const accepted = message.payload?.accepted === true;
  const source = typeof message.payload?.source === 'string' ? message.payload.source : 'unknown';
  const pluginVersion = getPluginVersion();

  if (accepted) {
    await setTelemetryConsent(true);
    await trackEvent('telemetry_consent', { action: 'accept', source, pluginVersion });
  } else {
    // 저장 전에 전송 — 철회(현재 ACCEPTED)면 통과, 최초 거부(PENDING)면 게이팅에 막힘.
    await trackEvent('telemetry_consent', { action: 'deny', source, pluginVersion });
    await setTelemetryConsent(false);
  }

  const profile = await readProfile();
  connections.sendTo(connectionId, 'ACK', {
    requestId: message.requestId,
    status: 'ok',
    consentStatus: profile.telemetryConsent.status,
    decidedAt: profile.telemetryConsent.decidedAt,
  });
}
