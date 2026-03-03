import { useState } from 'react';
import { ToolUse } from '../types';
import { ToolUseStatus } from '../dto/common';

interface ToolCardProps {
  toolUse: ToolUse;
  onApprove?: (toolId: string) => void;
  onDeny?: (toolId: string) => void;
}

export function ToolCard({ toolUse, onApprove, onDeny }: ToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = {
    pending: {
      bg: 'bg-amber-900/20',
      border: 'border-amber-700/50',
      text: 'text-amber-400',
      icon: '⏳',
      label: 'Pending Approval',
      pulse: true,
    },
    approved: {
      bg: 'bg-blue-900/20',
      border: 'border-blue-700/50',
      text: 'text-blue-400',
      icon: '✓',
      label: 'Approved',
      pulse: false,
    },
    denied: {
      bg: 'bg-red-900/20',
      border: 'border-red-700/50',
      text: 'text-red-400',
      icon: '✗',
      label: 'Denied',
      pulse: false,
    },
    executing: {
      bg: 'bg-blue-900/20',
      border: 'border-blue-700/50',
      text: 'text-blue-400',
      icon: '⚡',
      label: 'Executing',
      pulse: true,
    },
    completed: {
      bg: 'bg-green-900/20',
      border: 'border-green-700/50',
      text: 'text-green-400',
      icon: '✓',
      label: 'Completed',
      pulse: false,
    },
    failed: {
      bg: 'bg-red-900/20',
      border: 'border-red-700/50',
      text: 'text-red-400',
      icon: '!',
      label: 'Failed',
      pulse: false,
    },
  };

  const config = statusConfig[toolUse.status];

  return (
    <div className={`my-4 border ${config.border} ${config.bg} rounded-xl overflow-hidden backdrop-blur-sm shadow-lg ${config.pulse ? 'animate-pulse-subtle' : ''}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors duration-150"
      >
        <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${config.bg} border ${config.border} ${config.pulse ? 'animate-pulse' : ''}`}>
          <span className="text-lg">{config.icon}</span>
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-zinc-200 text-sm tracking-tight">
              {toolUse.name}
            </span>
            <span className={`text-xs ${config.text} font-mono uppercase tracking-wider`}>
              {config.label}
            </span>
          </div>
          <div className="text-xs text-zinc-500 font-mono">
            Tool ID: {toolUse.id.slice(0, 8)}...
          </div>
        </div>

        <svg
          className={`w-5 h-5 text-zinc-500 transition-transform duration-200 ${
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
        <div className="border-t border-zinc-800/50">
          <div className="p-4 space-y-3">
            {/* Input Details */}
            <div>
              <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">
                Input Parameters
              </div>
              <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-3 font-mono text-xs text-zinc-300 overflow-x-auto">
                <pre className="whitespace-pre-wrap break-all">
                  {JSON.stringify(toolUse.input, null, 2)}
                </pre>
              </div>
            </div>

            {/* Result */}
            {toolUse.result && (
              <div>
                <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">
                  Result
                </div>
                <div className="bg-zinc-950/50 border border-green-900/30 rounded-lg p-3 font-mono text-xs text-green-400/80 overflow-x-auto">
                  <pre className="whitespace-pre-wrap break-all">
                    {toolUse.result}
                  </pre>
                </div>
              </div>
            )}

            {/* Error */}
            {toolUse.error && (
              <div>
                <div className="text-xs font-mono text-red-500 uppercase tracking-wider mb-2">
                  Error
                </div>
                <div className="bg-zinc-950/50 border border-red-900/30 rounded-lg p-3 font-mono text-xs text-red-400/80 overflow-x-auto">
                  <pre className="whitespace-pre-wrap break-all">
                    {toolUse.error}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {toolUse.status === ToolUseStatus.Pending && (
            <div className="border-t border-zinc-800/50 p-3 flex gap-2">
              <button
                onClick={() => onApprove?.(toolUse.id)}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-all duration-150 active:scale-95 shadow-md shadow-blue-900/30 text-sm tracking-tight"
              >
                Approve
              </button>
              <button
                onClick={() => onDeny?.(toolUse.id)}
                className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg transition-all duration-150 active:scale-95 text-sm tracking-tight"
              >
                Deny
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
