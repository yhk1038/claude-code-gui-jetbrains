import { XMarkIcon, Bars3Icon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useCloseSettings } from './useCloseSettings';
import { useRouter } from '@/router';
import { useTranslation } from '@/i18n';

interface SettingsHeaderProps {
  /** On mobile, toggles the sidebar drawer. Omitted (hidden) on desktop. */
  onToggleSidebar?: () => void;
}

export function SettingsHeader({ onToggleSidebar }: SettingsHeaderProps) {
  const { goBack } = useRouter();
  const onClose = useCloseSettings();
  const { t } = useTranslation('settings');

  return (
    <header className="flex items-center justify-between gap-2 px-4 py-4 xs:px-2 xs:py-1 border-b border-border-default">
      <button
        onClick={() => goBack()}
        className="hidden xs:inline-block p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
        title={t('layout.back')}
      >
        <ArrowLeftIcon className="w-6 h-6 xs:w-4 xs:h-4" />
      </button>

      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          title={t('layout.toggleMenu')}
        >
          <Bars3Icon className="w-6 h-6 xs:w-4 xs:h-4" />
        </button>
      )}
      <h1 className="text-lg xs:text-sm font-semibold text-text-primary">{t('layout.title')}</h1>
      <button
        onClick={onClose}
        className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
        title={t('layout.close')}
      >
        <XMarkIcon className="w-6 h-6 xs:w-4 xs:h-4" />
      </button>
    </header>
  );
}
