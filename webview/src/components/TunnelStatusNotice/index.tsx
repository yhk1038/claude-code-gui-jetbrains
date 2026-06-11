import { useState } from 'react';
import {
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { tunnelErrorGuidance, type TunnelErrorCode } from '@/hooks';
import { getAdapter } from '@/adapters';

interface Props {
  cloudflaredAvailable: boolean | null;
  tunnelEnabled: boolean;
  tunnelLoading: boolean;
  installing: boolean;
  awaitingInstallConsent: boolean;
  error: string | null;
  errorCode: TunnelErrorCode | null;
  onRetry: () => void;
  onConfirmInstall: () => void;
  onCancelInstall: () => void;
}

/**
 * Shared notice shown above the tunnel toggle in both the chat modal and the
 * settings page: an actionable error panel, an install-consent prompt when
 * cloudflared is missing, or an upfront warning that it isn't installed yet.
 */
export function TunnelStatusNotice(props: Props) {
  const {
    cloudflaredAvailable,
    tunnelEnabled,
    tunnelLoading,
    installing,
    awaitingInstallConsent,
    error,
    errorCode,
    onRetry,
    onConfirmInstall,
    onCancelInstall,
  } = props;
  const [copied, setCopied] = useState(false);

  if (error) {
    const guidance = tunnelErrorGuidance(errorCode, error);

    const handleCopy = () => {
      if (!guidance.manualInstallCommand) return;
      navigator.clipboard.writeText(guidance.manualInstallCommand).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    };

    return (
      <div className="py-2 px-3 text-sm text-state-error-fg bg-state-error-bg rounded space-y-2">
        <div className="font-medium">{guidance.title}</div>
        <div className="text-xs opacity-90">{guidance.detail}</div>

        {guidance.manualInstallCommand && (
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs bg-surface-raised px-2 py-1 rounded truncate">
              {guidance.manualInstallCommand}
            </code>
            <button onClick={handleCopy} className="flex-shrink-0" title="Copy command">
              {copied
                ? <ClipboardDocumentCheckIcon className="w-4 h-4 text-state-success-fg" />
                : <ClipboardDocumentIcon className="w-4 h-4 cursor-pointer" />
              }
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button onClick={onRetry} className="text-xs font-medium underline cursor-pointer">
            Try again
          </button>
          {guidance.helpUrl && (
            <button
              onClick={() => getAdapter().openUrl(guidance.helpUrl as string)}
              className="text-xs underline opacity-90 cursor-pointer"
            >
              Install guide
            </button>
          )}
        </div>
      </div>
    );
  }

  if (awaitingInstallConsent) {
    return (
      <div className="py-2 px-3 text-xs text-state-warning-fg bg-state-warning-bg rounded space-y-2">
        <div className="flex items-start gap-2">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            cloudflared isn’t installed. Install it now and enable the tunnel? This downloads
            cloudflared (about 3 minutes the first time).
          </span>
        </div>
        <div className="flex items-center gap-3 pt-1 pl-6">
          <button onClick={onConfirmInstall} className="text-xs font-medium underline cursor-pointer">
            Install &amp; enable
          </button>
          <button onClick={onCancelInstall} className="text-xs underline opacity-80 cursor-pointer">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (cloudflaredAvailable === false && !tunnelEnabled && !tunnelLoading && !installing) {
    return (
      <div className="py-2 px-3 text-xs text-state-warning-fg bg-state-warning-bg rounded flex items-start gap-2">
        <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          cloudflared isn’t installed yet. Turning the tunnel on will ask to download it
          (about 3 minutes the first time).
        </span>
      </div>
    );
  }

  return null;
}
