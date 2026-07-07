import { useState } from 'react';
import { ToolUse } from '../../types';
import { ToolUseStatus } from '../../dto/common';
import { useTranslation } from '@/i18n';

interface ToolCardProps {
  toolUse: ToolUse;
  onApprove?: (toolId: string) => void;
  onDeny?: (toolId: string) => void;
}

export function ToolCard({ toolUse, onApprove, onDeny }: ToolCardProps) {
  const { t } = useTranslation('chat');
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = {
    pending: {
      bg: 'bg-state-pending-bg',
      border: 'border-state-pending-border',
      text: 'text-state-pending-fg',
      icon: '⏳',
      label: t('toolCard.status.pending'),
      pulse: true,
    },
    approved: {
      bg: 'bg-state-info-bg',
      border: 'border-state-info-border',
      text: 'text-text-link',
      icon: '✓',
      label: t('toolCard.status.approved'),
      pulse: false,
    },
    denied: {
      bg: 'bg-state-error-bg',
      border: 'border-state-error-border',
      text: 'text-state-error-fg',
      icon: '✗',
      label: t('toolCard.status.denied'),
      pulse: false,
    },
    executing: {
      bg: 'bg-state-info-bg',
      border: 'border-state-info-border',
      text: 'text-text-link',
      icon: '⚡',
      label: t('toolCard.status.executing'),
      pulse: true,
    },
    completed: {
      bg: 'bg-state-success-bg',
      border: 'border-state-success-border',
      text: 'text-state-success-fg',
      icon: '✓',
      label: t('toolCard.status.completed'),
      pulse: false,
    },
    failed: {
      bg: 'bg-state-error-bg',
      border: 'border-state-error-border',
      text: 'text-state-error-fg',
      icon: '!',
      label: t('toolCard.status.failed'),
      pulse: false,
    },
  };

  const config = statusConfig[toolUse.status] ?? statusConfig.pending;

  return (
    <div className={`my-4 border ${config.border} ${config.bg} rounded-xl overflow-hidden backdrop-blur-sm shadow-lg ${config.pulse ? 'animate-pulse-subtle' : ''}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-hover transition-colors duration-150"
      >
        <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${config.bg} border ${config.border} ${config.pulse ? 'animate-pulse' : ''}`}>
          <span className="text-lg">{config.icon}</span>
        </div>

        <div className="flex-1 text-start min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-text-primary text-sm tracking-tight">
              {toolUse.name}
            </span>
            <span className={`text-xs ${config.text} font-mono uppercase tracking-wider`}>
              {config.label}
            </span>
          </div>
          <div className="text-xs text-text-tertiary font-mono">
            {t('toolCard.toolId', { id: toolUse.id.slice(0, 8) })}
          </div>
        </div>

        <svg
          className={`w-5 h-5 text-text-tertiary transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border-divider">
          <div className="p-4 space-y-3">
            {/* Input Details */}
            <div>
              <div className="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">
                {t('toolCard.inputParameters')}
              </div>
              <div className="bg-surface-base/50 border border-border-divider rounded-lg p-3 font-mono text-xs text-text-secondary overflow-x-auto">
                <pre dir="ltr" className="whitespace-pre-wrap break-all">
                  {JSON.stringify(toolUse.input, null, 2)}
                </pre>
              </div>
            </div>

            {/* Result */}
            {toolUse.result && (
              <div>
                <div className="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">
                  {t('toolCard.result')}
                </div>
                <div className="bg-surface-base/50 border border-state-success-border rounded-lg p-3 font-mono text-xs text-state-success-fg/80 overflow-x-auto">
                  <pre dir="ltr" className="whitespace-pre-wrap break-all">
                    {toolUse.result}
                  </pre>
                </div>
              </div>
            )}

            {/* Error */}
            {toolUse.error && (
              <div>
                <div className="text-xs font-mono text-state-error-fg uppercase tracking-wider mb-2">
                  {t('toolCard.error')}
                </div>
                <div className="bg-surface-base/50 border border-state-error-border rounded-lg p-3 font-mono text-xs text-state-error-fg/80 overflow-x-auto">
                  <pre dir="ltr" className="whitespace-pre-wrap break-all">
                    {toolUse.error}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {toolUse.status === ToolUseStatus.Pending && (
            <div className="border-t border-border-divider p-3 flex gap-2">
              <button
                onClick={() => onApprove?.(toolUse.id)}
                className="flex-1 px-4 py-2.5 bg-accent-primary-hover hover:bg-accent-primary text-text-primary font-medium rounded-lg transition-all duration-150 active:scale-95 shadow-md shadow-blue-900/30 text-sm tracking-tight"
              >
                {t('toolCard.approve')}
              </button>
              <button
                onClick={() => onDeny?.(toolUse.id)}
                className="flex-1 px-4 py-2.5 bg-surface-overlay hover:bg-surface-tooltip text-text-secondary font-medium rounded-lg transition-all duration-150 active:scale-95 text-sm tracking-tight"
              >
                {t('toolCard.deny')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
