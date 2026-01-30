import { useState } from 'react';
import { PermissionRequest } from '../hooks/usePermissions';

interface PermissionBannerProps {
  request: PermissionRequest;
  onApprove: () => void;
  onDeny: () => void;
  onExpand: () => void;
}

export function PermissionBanner({ request, onApprove, onDeny, onExpand }: PermissionBannerProps) {
  const { toolUse, riskLevel, description } = request;
  const [isHovered, setIsHovered] = useState(false);

  const riskConfig = {
    low: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/40',
      text: 'text-green-400',
      icon: '✓',
      label: 'Low',
    },
    medium: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/40',
      text: 'text-amber-400',
      icon: '⚠',
      label: 'Medium',
    },
    high: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/40',
      text: 'text-red-400',
      icon: '⛔',
      label: 'High',
    },
  };

  const config = riskConfig[riskLevel];

  return (
    <div
      className={`my-3 border ${config.border} ${config.bg} rounded-xl overflow-hidden backdrop-blur-sm shadow-lg transition-all duration-200 ${isHovered ? 'shadow-xl scale-[1.01]' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Risk Indicator */}
        <div className={`w-10 h-10 flex items-center justify-center rounded-lg ${config.bg} border-2 ${config.border} shadow-md flex-shrink-0`}>
          <span className="text-lg">{config.icon}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-mono uppercase tracking-wider ${config.text} font-bold`}>
              {config.label} Risk
            </span>
            <span className="text-zinc-700">•</span>
            <span className="text-xs text-zinc-500 font-mono">
              {toolUse.name}
            </span>
          </div>
          <p className="text-sm text-zinc-300 font-medium tracking-tight truncate">
            {description}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onApprove}
            className={`px-4 py-2 ${config.bg} ${config.border} border ${config.text} font-bold rounded-lg transition-all duration-150 hover:scale-105 active:scale-95 text-xs uppercase tracking-wide`}
          >
            Allow
          </button>
          <button
            onClick={onDeny}
            className="px-4 py-2 bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 font-bold rounded-lg transition-all duration-150 hover:scale-105 active:scale-95 text-xs uppercase tracking-wide"
          >
            Deny
          </button>
          <button
            onClick={onExpand}
            className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 rounded-lg transition-all duration-150"
            title="View details"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="8" cy="8" r="6" />
              <path d="M8 6v4M8 11h.01" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
