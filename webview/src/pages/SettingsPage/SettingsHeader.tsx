import { XMarkIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { Label, ROUTE_META, Route } from '@/router/routes';
import { useCloseSettings } from './useCloseSettings';

interface SettingsHeaderProps {
  /** On mobile, toggles the sidebar drawer. Omitted (hidden) on desktop. */
  onToggleSidebar?: () => void;
}

export function SettingsHeader({ onToggleSidebar }: SettingsHeaderProps) {
  const onClose = useCloseSettings();
  const meta = ROUTE_META[Route.SETTINGS];

  return (
    <header className="flex items-center justify-between gap-2 px-4 py-4 xs:px-2 xs:py-1 border-b border-border-default">
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          title="Toggle menu"
        >
          <Bars3Icon className="w-6 h-6 xs:w-4 xs:h-4" />
        </button>
      )}
      <h1 className="text-lg xs:text-sm font-semibold text-text-primary">{meta.label}</h1>
      <button
        onClick={onClose}
        className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
        title={Label.CLOSE}
      >
        <XMarkIcon className="w-6 h-6 xs:w-4 xs:h-4" />
      </button>
    </header>
  );
}
