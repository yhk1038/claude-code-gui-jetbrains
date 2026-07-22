import { useSyncExternalStore } from 'react';
import {
  getPairingStatus,
  subscribePairingStatus,
  type PairingState,
  type PairingFailureReason,
} from '@/api/bridge/authToken';

export interface PairingStatus {
  state: PairingState;
  reason: PairingFailureReason;
}

// Cache the last snapshot so useSyncExternalStore gets a stable reference while
// nothing changed (getPairingStatus() returns a fresh object each call).
let lastSnapshot: PairingStatus = getPairingStatus();

function getSnapshot(): PairingStatus {
  const next = getPairingStatus();
  if (next.state !== lastSnapshot.state || next.reason !== lastSnapshot.reason) {
    lastSnapshot = next;
  }
  return lastSnapshot;
}

/**
 * Subscribe to the Remote-Control pairing lifecycle (idle → pairing → paired |
 * failed). Drives the "pairing expired — rescan the QR" notice on a remote
 * device whose `?pair=` code could not be exchanged for a token.
 */
export function usePairingStatus(): PairingStatus {
  return useSyncExternalStore(subscribePairingStatus, getSnapshot);
}
