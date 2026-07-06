import { useState } from 'react';
import { useTranslation } from '@/i18n';

interface Props {
  onRetry: () => void;
  isLoading: boolean;
}

type CopyState = 'idle' | 'copied' | 'failed';

const INSTALL_CMD = 'npm install -g claude-code-battery';

export function CcbNotInstalledNotice(props: Props) {
  const { onRetry, isLoading } = props;
  const { t } = useTranslation('settings');
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const copy = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(INSTALL_CMD);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  };

  const copyLabel = copyState === 'copied' ? t('usage.notInstalled.copied') : copyState === 'failed' ? t('usage.notInstalled.copyFailed') : t('usage.notInstalled.copy');

  return (
    <div className="mb-6 p-4 bg-surface-raised border border-border-default rounded-lg">
      <h3 className="text-sm font-semibold text-text-primary mb-2">
        {t('usage.notInstalled.title')}
      </h3>
      <p className="text-sm text-text-secondary mb-3">
        {t('usage.notInstalled.description')}
      </p>
      <p className="text-sm text-text-secondary mb-3">
        {t('usage.notInstalled.installVia')}
      </p>
      <div className="flex items-center gap-2 mb-3 p-2 bg-surface-base border border-border-default rounded font-mono text-xs text-text-secondary">
        <code className="flex-1">{INSTALL_CMD}</code>
        <button
          onClick={copy}
          className="px-2 py-1 text-xs rounded bg-surface-overlay hover:bg-surface-tooltip transition-colors"
        >
          {copyLabel}
        </button>
      </div>
      <p className="text-xs text-text-tertiary mb-3">
        {t('usage.notInstalled.retryHint')}
      </p>
      <button
        onClick={onRetry}
        disabled={isLoading}
        className="px-3 py-1.5 text-xs rounded bg-accent-primary-hover hover:bg-accent-primary text-text-primary transition-colors disabled:opacity-50"
      >
        {isLoading ? t('usage.notInstalled.checking') : t('usage.notInstalled.retry')}
      </button>
    </div>
  );
}
