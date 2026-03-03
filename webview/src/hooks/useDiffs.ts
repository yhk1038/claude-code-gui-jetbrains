import { useCallback, useState } from 'react';
import { PendingDiff, DiffStatus } from '../types';

interface UseDiffsReturn {
  pendingDiffs: PendingDiff[];
  addDiff: (diff: Omit<PendingDiff, 'status'>) => void;
  applyDiff: (diffId: string) => Promise<void>;
  rejectDiff: (diffId: string) => void;
  applyAll: () => Promise<void>;
  rejectAll: () => void;
  clearDiffs: () => void;
  getDiffById: (diffId: string) => PendingDiff | undefined;
  hasPendingDiffs: boolean;
}

export function useDiffs(): UseDiffsReturn {
  const [pendingDiffs, setPendingDiffs] = useState<PendingDiff[]>([]);

  const addDiff = useCallback((diff: Omit<PendingDiff, 'status'>) => {
    const newDiff: PendingDiff = {
      ...diff,
      status: DiffStatus.Pending,
    };
    setPendingDiffs(prev => [...prev, newDiff]);
  }, []);

  const applyDiff = useCallback(async (diffId: string) => {
    setPendingDiffs(prev => prev.map(d =>
      d.id === diffId ? { ...d, status: DiffStatus.Applied } : d
    ));
    // Actual application will be handled by bridge
  }, []);

  const rejectDiff = useCallback((diffId: string) => {
    setPendingDiffs(prev => prev.map(d =>
      d.id === diffId ? { ...d, status: DiffStatus.Rejected } : d
    ));
  }, []);

  const applyAll = useCallback(async () => {
    const pendingIds = pendingDiffs.filter(d => d.status === DiffStatus.Pending).map(d => d.id);
    for (const id of pendingIds) {
      await applyDiff(id);
    }
  }, [pendingDiffs, applyDiff]);

  const rejectAll = useCallback(() => {
    setPendingDiffs(prev => prev.map(d =>
      d.status === DiffStatus.Pending ? { ...d, status: DiffStatus.Rejected } : d
    ));
  }, []);

  const clearDiffs = useCallback(() => {
    setPendingDiffs([]);
  }, []);

  const getDiffById = useCallback((diffId: string) => {
    return pendingDiffs.find(d => d.id === diffId);
  }, [pendingDiffs]);

  const hasPendingDiffs = pendingDiffs.some(d => d.status === DiffStatus.Pending);

  return {
    pendingDiffs,
    addDiff,
    applyDiff,
    rejectDiff,
    applyAll,
    rejectAll,
    clearDiffs,
    getDiffById,
    hasPendingDiffs,
  };
}
