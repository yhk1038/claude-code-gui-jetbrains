import type { ConnectionManager } from '../../ws/connection-manager';
import type { Bridge } from '../../bridge/bridge-interface';
import type { IPCMessage } from '../types';
import { readProfile } from '../features/profile';
import { findSponsorByInstall, saveLicense, getSponsorStatus, reportActivation } from '../features/license';
import { MessageType } from '../../shared';

/**
 * Copy/paste-free activation. If this install isn't a sponsor yet, ask www whether
 * a sponsor key has been minted for its install id (linked via the checkout the
 * plugin opened); if so, store it. Returns the resulting sponsor status. The plugin
 * polls this while the Sponsor screen is open so a completed payment activates on
 * its own.
 */
export async function checkSponsorHandler(
  connectionId: string,
  message: IPCMessage,
  connections: ConnectionManager,
  _bridge: Bridge,
): Promise<void> {
  const before = await getSponsorStatus();
  if (!before.isSponsor) {
    const profile = await readProfile();
    const sponsorKey = await findSponsorByInstall(profile.uuid);
    if (sponsorKey !== null) {
      await saveLicense({
        licenseKey: sponsorKey,
        status: 'active',
        verifiedAt: new Date().toISOString(),
      });
      // Report this install's activation to www (fire-and-forget).
      void reportActivation(sponsorKey);
    }
  }

  const sponsor = await getSponsorStatus();
  connections.sendTo(connectionId, MessageType.ACK, {
    requestId: message.requestId,
    status: 'ok',
    isSponsor: sponsor.isSponsor,
    licenseKey: sponsor.licenseKey,
    licenseStatus: sponsor.status,
  });
}
