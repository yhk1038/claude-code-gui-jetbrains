import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { readProfile } from '../features/profile';

/** 현재 텔레메트리 동의 상태를 반환한다(uuid 등 식별자는 노출하지 않는다). */
export async function getTelemetryConsentHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const profile = await readProfile();
  connections.sendTo(connectionId, 'ACK', {
    requestId: message.requestId,
    status: 'ok',
    consentStatus: profile.telemetryConsent.status,
    decidedAt: profile.telemetryConsent.decidedAt,
  });
}
