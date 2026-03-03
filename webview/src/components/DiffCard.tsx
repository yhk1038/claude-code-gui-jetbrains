import { useState } from 'react';
import { PendingDiff, DiffStatus } from '../types';
import { DiffViewer } from './DiffViewer';

interface DiffCardProps {
  diff: PendingDiff;
  onApply: (diffId: string) => Promise<void>;
  onReject: (diffId: string) => void;
  onOpenInIDE?: (diffId: string) => Promise<void>;
}

export function DiffCard({ diff, onApply, onReject, onOpenInIDE }: DiffCardProps) {
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
        return 'Create';
      case 'modify':
        return 'Modify';
      case 'delete':
        return 'Delete';
    }
  };

  const getOperationColor = () => {
    switch (diff.summary.operation) {
      case 'create':
        return 'text-green-400';
      case 'modify':
        return 'text-blue-400';
      case 'delete':
        return 'text-red-400';
    }
  };

  const getStatusBadge = () => {
    switch (diff.status) {
      case DiffStatus.Pending:
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-yellow-900/30 text-yellow-400">
            Pending
          </span>
        );
      case DiffStatus.Applied:
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-green-900/30 text-green-400">
            Applied
          </span>
        );
      case DiffStatus.Rejected:
        return (
          <span className="px-2 py-0.5 text-xs rounded bg-red-900/30 text-red-400">
            Rejected
          </span>
        );
    }
  };

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-700 bg-zinc-800/50">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
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
              <span className="text-sm font-mono text-zinc-300 truncate">
                {diff.filePath}
              </span>
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
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
                  className="px-3 py-1 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Open in IDE diff viewer"
                >
                  {isOpeningDiff ? 'Opening...' : 'Open in IDE'}
                </button>
              )}
              <button
                onClick={handleApply}
                disabled={isApplying || isOpeningDiff}
                className="px-3 py-1 text-sm rounded bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplying ? 'Applying...' : 'Apply'}
              </button>
              <button
                onClick={() => onReject(diff.id)}
                disabled={isApplying || isOpeningDiff}
                className="px-3 py-1 text-sm rounded bg-zinc-700 hover:bg-zinc-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      {/* Diff Content */}
      {isExpanded && (
        <div className="p-4 bg-zinc-900">
          <DiffViewer filePath={diff.filePath} diffText={diff.diff} />
        </div>
      )}
    </div>
  );
}
