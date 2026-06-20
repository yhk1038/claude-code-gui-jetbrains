import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { setTelemetryConsent, readProfile, ConsentStatus } from '../features/profile';
import { trackEvent } from '../features/telemetry';
import { getPluginVersion } from './getVersion';

/**
 * 텔레메트리 수락(accept)/거부(deny)를 profile.json에 기록하고, 'telemetry_consent'
 * 이벤트를 전송한다(전송은 fire-and-forget — await/then 없음).
 *
 * - accept: 저장(ACCEPTED) 후 전송 → 동의 게이팅 통과.
 * - deny + 이전이 ACCEPTED(=철회): 이전 동의 하에 철회 사실을 전송(게이팅 우회).
 * - deny + 이전이 PENDING(=최초 거부): 전송하지 않는다(비동의 전송 회피).
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

  const before = await readProfile();

  if (accepted) {
    await setTelemetryConsent(true);
    trackEvent('telemetry_consent', { action: 'accept', source, pluginVersion });
  } else {
    await setTelemetryConsent(false);
    if (before.telemetryConsent.status === ConsentStatus.ACCEPTED) {
      // 철회: 이전 동의 하에 철회 사실만 1회 전송. 게이팅은 이미 DENIED라 우회한다.
      trackEvent(
        'telemetry_consent',
        { action: 'deny', source, pluginVersion },
        { requireConsent: false },
      );
    }
  }

  const profile = await readProfile();
  connections.sendTo(connectionId, 'ACK', {
    requestId: message.requestId,
    status: 'ok',
    consentStatus: profile.telemetryConsent.status,
    decidedAt: profile.telemetryConsent.decidedAt,
  });
}
