import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { setTelemetryConsent } from '../features/profile';

/** 텔레메트리 수락/거절을 profile.json에 기록한다(타임스탬프 포함). */
export async function setTelemetryConsentHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const granted = message.payload?.granted === true;
  const profile = await setTelemetryConsent(granted);
  connections.sendTo(connectionId, 'ACK', {
    requestId: message.requestId,
    status: 'ok',
    consentStatus: profile.telemetryConsent.status,
    decidedAt: profile.telemetryConsent.decidedAt,
  });
}
