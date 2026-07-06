import { useState } from 'react';
import { PendingDiff, DiffStatus } from '../../types';
import { DiffCard } from './DiffCard';
import { useTranslation } from '@/i18n';

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
  const { t } = useTranslation('chat');
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
        <div className="text-text-tertiary text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-text-disabled"
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
          <p className="text-lg font-medium">{t('diffList.noChanges')}</p>
          <p className="text-sm mt-1">{t('diffList.noChangesHint')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary Header */}
      {hasPending && (
        <div className="px-4 py-3 border-b border-border-default bg-surface-hover flex items-center justify-between">
          <div className="text-sm text-text-secondary">
            <span className="font-medium">{pendingDiffs.length}</span>{' '}
            {t('diffList.pendingCount', { count: pendingDiffs.length })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApplyAll}
              disabled={isApplyingAll}
              className="px-3 py-1.5 text-sm rounded bg-state-success-fg hover:bg-state-success-fg text-text-inverse transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplyingAll ? t('diffList.applyingAll') : t('diffList.applyAll')}
            </button>
            <button
              onClick={onRejectAll}
              disabled={isApplyingAll}
              className="px-3 py-1.5 text-sm rounded bg-surface-tooltip hover:bg-surface-pressed text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('diffList.rejectAll')}
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
