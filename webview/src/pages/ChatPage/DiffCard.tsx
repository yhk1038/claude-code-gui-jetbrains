import { useState } from 'react';
import { PendingDiff, DiffStatus } from '../../types';
import { DiffViewer } from './DiffViewer';
import { useTranslation } from '@/i18n';

interface DiffCardProps {
  diff: PendingDiff;
  onApply: (diffId: string) => Promise<void>;
  onReject: (diffId: string) => void;
  onOpenInIDE?: (diffId: string) => Promise<void>;
}

export function DiffCard({ diff, onApply, onReject, onOpenInIDE }: DiffCardProps) {
  const { t } = useTranslation('chat');
  const [isExpanded, setIsExpanded] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [isOpeningDiff, setIsOpeningDiff] = useState(false);

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApply(diff.id);
    } finally {
      setIsApplying(false);
    }
  };

  const handleOpenInIDE = async () => {
    if (!onOpenInIDE) return;

    setIsOpeningDiff(true);
    try {
      await onOpenInIDE(diff.id);
    } finally {
      setIsOpeningDiff(false);
    }
  };

  const getOperationLabel = () => {
    switch (diff.summary.operation) {
      case 'create':
        return t('diffCard.operation.create');
      case 'modify':
        return t('diffCard.operation.modify');
      case 'delete':
        return t('diffCard.operation.delete');
    }
  };

  const getOperationColor = () => {
    switch (diff.summary.operation) {
      case 'create':
        return 'text-state-success-fg';
      case 'modify':
        return 'text-text-link';
      case 'delete':
        return 'text-state-error-fg';
    }
  };

  const getStatusBadge = () => {
    switch (diff.status) {
      case DiffStatus.Pending:
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-state-warning-bg text-state-warning-fg">
            {t('diffCard.status.pending')}
          </span>
        );
      case DiffStatus.Applied:
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-state-success-bg text-state-success-fg">
            {t('diffCard.status.applied')}
          </span>
        );
      case DiffStatus.Rejected:
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-state-error-bg text-state-error-fg">
            {t('diffCard.status.rejected')}
          </span>
        );
    }
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border-default bg-surface-hover">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-text-secondary hover:text-text-primary transition-colors flex-shrink-0"
            aria-label={isExpanded ? t('diffCard.collapse') : t('diffCard.expand')}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${getOperationColor()}`}>
                {getOperationLabel()}
              </span>
              <span className="text-sm font-mono text-text-secondary truncate">
                {diff.filePath}
              </span>
            </div>
            <div className="text-xs text-text-tertiary mt-0.5">
              +{diff.summary.additions} -{diff.summary.deletions}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {getStatusBadge()}
          {diff.status === DiffStatus.Pending && (
            <>
              {onOpenInIDE && (
                <button
                  onClick={handleOpenInIDE}
                  disabled={isApplying || isOpeningDiff}
                  className="px-3 py-1 text-sm rounded bg-accent-primary-hover hover:bg-accent-primary-pressed text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t('diffCard.openInIdeTitle')}
                >
                  {isOpeningDiff ? t('diffCard.opening') : t('diffCard.openInIde')}
                </button>
              )}
              <button
                onClick={handleApply}
                disabled={isApplying || isOpeningDiff}
                className="px-3 py-1 text-sm rounded bg-state-success-fg hover:bg-state-success-fg text-text-inverse transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplying ? t('diffCard.applying') : t('diffCard.apply')}
              </button>
              <button
                onClick={() => onReject(diff.id)}
                disabled={isApplying || isOpeningDiff}
                className="px-3 py-1 text-sm rounded bg-surface-tooltip hover:bg-surface-pressed text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('diffCard.reject')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Diff Content */}
      {isExpanded && (
        <div className="p-4 bg-surface-raised">
          <DiffViewer filePath={diff.filePath} diffText={diff.diff} />
        </div>
      )}
    </div>
  );
}
