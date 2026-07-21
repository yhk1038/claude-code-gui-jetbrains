import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '@/i18n';
import { useInstallCcb } from '@/hooks/queries/useInstallCcb';
import { useCcbInstallHint } from '@/hooks/queries/useCcbInstallHint';

interface Props {
  onRetry: () => void;
  isLoading: boolean;
}

type CopyState = 'idle' | 'copied' | 'failed';

export function CcbNotInstalledNotice(props: Props) {
  const { onRetry, isLoading } = props;
  const { t } = useTranslation('settings');
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const { install, installing } = useInstallCcb();
  const hint = useCcbInstallHint();

  const copy = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(hint.command);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  };

  // Primary path: the backend installs ccb itself (npm i -g via the Command core,
  // so no shell choice / PowerShell wall). On a permission-blocked global location
  // the backend returns a runnable command as the error, surfaced as a toast.
  const handleInstall = async () => {
    try {
      await install();
      toast.success(t('usage.notInstalled.installed'));
      onRetry();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('usage.notInstalled.installFailed'));
    }
  };

  const copyLabel = copyState === 'copied' ? t('usage.notInstalled.copied') : copyState === 'failed' ? t('usage.notInstalled.copyFailed') : t('usage.notInstalled.copy');

  return (
    <div className="mb-6 p-4 bg-surface-raised border border-border-default rounded-lg">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-text-primary">
          {t('usage.notInstalled.title')}
        </h3>
        <button
          onClick={onRetry}
          disabled={isLoading}
          title={t('usage.notInstalled.reload')}
          aria-label={t('usage.notInstalled.reload')}
          className="flex-shrink-0 p-1 rounded hover:bg-surface-hover transition-colors disabled:opacity-40"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <p className="text-sm text-text-secondary mb-3">
        {t('usage.notInstalled.description')}
      </p>

      <p className="text-xs text-text-tertiary mb-2">
        {t('usage.notInstalled.installVia')}
      </p>

      <div className="flex items-center gap-2 mb-2 p-2 bg-surface-base border border-border-default rounded font-mono text-xs text-text-secondary">
        <code className="flex-1 break-all">{hint.command}</code>
        <button
          onClick={copy}
          className="flex-shrink-0 px-2 py-1 text-xs rounded bg-surface-overlay hover:bg-surface-tooltip transition-colors"
        >
          {copyLabel}
        </button>
      </div>

      {hint.shells.length > 0 && (
        <p className="text-xs text-text-tertiary mb-3">
          {t('usage.notInstalled.pasteIn', { shells: hint.shells.join(', ') })}
        </p>
      )}

      <p className="text-xs text-text-tertiary mb-2">
        {t('usage.notInstalled.or')}
      </p>

      <button
        onClick={() => void handleInstall()}
        disabled={installing}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-accent-primary-hover hover:bg-accent-primary text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {installing && <ArrowPathIcon className="w-3 h-3 animate-spin" />}
        {installing ? t('usage.notInstalled.installing') : t('usage.notInstalled.install')}
      </button>
    </div>
  );
}
