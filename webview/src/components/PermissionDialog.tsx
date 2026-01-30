import { useEffect } from 'react';
import { PermissionRequest } from '../hooks/usePermissions';

interface PermissionDialogProps {
  request: PermissionRequest;
  onApprove: (allowForSession: boolean) => void;
  onDeny: () => void;
}

export function PermissionDialog({ request, onApprove, onDeny }: PermissionDialogProps) {
  const { toolUse, riskLevel, description, details } = request;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onApprove(false);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onDeny();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onApprove, onDeny]);

  const riskConfig = {
    low: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      text: 'text-green-400',
      icon: '✓',
      label: 'Low Risk',
      glow: 'shadow-green-900/20',
    },
    medium: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      icon: '⚠',
      label: 'Medium Risk',
      glow: 'shadow-amber-900/20',
    },
    high: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      icon: '⛔',
      label: 'High Risk',
      glow: 'shadow-red-900/20',
    },
  };

  const config = riskConfig[riskLevel];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800/50 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Header with Risk Level */}
        <div className={`px-6 py-5 border-b border-zinc-800/50 ${config.bg}`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 flex items-center justify-center rounded-xl ${config.bg} border-2 ${config.border} ${config.glow} shadow-lg`}>
              <span className="text-3xl">{config.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-zinc-100 mb-1 tracking-tight">
                Permission Required
              </h2>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-mono uppercase tracking-wider ${config.text} font-semibold`}>
                  {config.label}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-sm text-zinc-500 font-mono">
                  {toolUse.name}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="px-6 py-5 border-b border-zinc-800/50">
          <div className="text-sm text-zinc-500 uppercase tracking-wider font-mono mb-3">
            Action
          </div>
          <p className="text-lg text-zinc-200 font-medium tracking-tight leading-relaxed">
            {description}
          </p>
        </div>

        {/* Details */}
        {details && (
          <div className="px-6 py-5 border-b border-zinc-800/50 bg-zinc-950/30">
            <div className="text-sm text-zinc-500 uppercase tracking-wider font-mono mb-3">
              Details
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {details}
            </p>
          </div>
        )}

        {/* Input Parameters */}
        <div className="px-6 py-5 border-b border-zinc-800/50">
          <div className="text-sm text-zinc-500 uppercase tracking-wider font-mono mb-3">
            Input Parameters
          </div>
          <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-4 font-mono text-xs text-zinc-300 overflow-x-auto max-h-48 overflow-y-auto">
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(toolUse.input, null, 2)}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-5 bg-zinc-950/30">
          <div className="flex flex-col gap-3">
            {/* Primary Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => onApprove(false)}
                className={`flex-1 px-5 py-3 ${config.bg} ${config.border} border-2 ${config.text} font-bold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 ${config.glow} shadow-lg text-sm tracking-tight uppercase`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>Allow</span>
                  <kbd className="px-2 py-0.5 bg-black/30 rounded text-xs font-mono">↵</kbd>
                </div>
              </button>
              <button
                onClick={onDeny}
                className="flex-1 px-5 py-3 bg-zinc-800/50 border-2 border-zinc-700/50 text-zinc-300 font-bold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg text-sm tracking-tight uppercase"
              >
                <div className="flex items-center justify-center gap-2">
                  <span>Deny</span>
                  <kbd className="px-2 py-0.5 bg-black/30 rounded text-xs font-mono">Esc</kbd>
                </div>
              </button>
            </div>

            {/* Session Permission Option */}
            <button
              onClick={() => onApprove(true)}
              className="w-full px-5 py-2.5 bg-zinc-900/50 border border-zinc-800/50 text-zinc-400 text-sm font-medium rounded-lg hover:bg-zinc-800/50 hover:text-zinc-300 transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-base">🔓</span>
                <span>Allow for this session</span>
              </div>
            </button>
          </div>

          {/* Keyboard Hint */}
          <div className="mt-4 pt-4 border-t border-zinc-800/30 text-center text-xs text-zinc-600 font-mono">
            Press <kbd className="px-1.5 py-0.5 bg-zinc-800/50 rounded">Enter</kbd> to allow, <kbd className="px-1.5 py-0.5 bg-zinc-800/50 rounded">Esc</kbd> to deny
          </div>
        </div>
      </div>
    </div>
  );
}
