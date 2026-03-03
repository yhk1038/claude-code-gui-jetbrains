import { useState } from 'react';
import { PendingDiff, DiffStatus } from '../types';
import { DiffCard } from './DiffCard';

interface DiffListProps {
  diffs: PendingDiff[];
  onApply: (diffId: string) => Promise<void>;
  onReject: (diffId: string) => void;
  onApplyAll: () => Promise<void>;
  onRejectAll: () => void;
}

export function DiffList({
  diffs,
  onApply,
  onReject,
  onApplyAll,
  onRejectAll,
}: DiffListProps) {
  const [isApplyingAll, setIsApplyingAll] = useState(false);

  const pendingDiffs = diffs.filter(d => d.status === DiffStatus.Pending);
  const hasPending = pendingDiffs.length > 0;

  const handleApplyAll = async () => {
    setIsApplyingAll(true);
    try {
      await onApplyAll();
    } finally {
      setIsApplyingAll(false);
    }
  };

  if (diffs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-zinc-500 text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-zinc-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg font-medium">No file changes</p>
          <p className="text-sm mt-1">Changes will appear here when available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary Header */}
      {hasPending && (
        <div className="px-4 py-3 border-b border-zinc-700 bg-zinc-800/50 flex items-center justify-between">
          <div className="text-sm text-zinc-300">
            <span className="font-medium">{pendingDiffs.length}</span> pending change
            {pendingDiffs.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApplyAll}
              disabled={isApplyingAll}
              className="px-3 py-1.5 text-sm rounded bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplyingAll ? 'Applying All...' : 'Apply All'}
            </button>
            <button
              onClick={onRejectAll}
              disabled={isApplyingAll}
              className="px-3 py-1.5 text-sm rounded bg-zinc-700 hover:bg-zinc-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reject All
            </button>
          </div>
        </div>
      )}

      {/* Diff Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {diffs.map((diff) => (
          <DiffCard
            key={diff.id}
            diff={diff}
            onApply={onApply}
            onReject={onReject}
          />
        ))}
      </div>
    </div>
  );
}
