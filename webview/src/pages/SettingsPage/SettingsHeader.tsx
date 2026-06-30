import { XMarkIcon } from '@heroicons/react/24/outline';
import { Label, ROUTE_META, Route } from '@/router/routes';
import { useCloseSettings } from './useCloseSettings';

export function SettingsHeader() {
  const onClose = useCloseSettings();
  const meta = ROUTE_META[Route.SETTINGS];

  return (
    <header className="flex items-center gap-2 px-2 py-1 border-b border-border-default">
      <h1 className="text-sm font-semibold text-text-primary">{meta.label}</h1>
      <button
        onClick={onClose}
        className="ml-auto p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
        title={Label.CLOSE}
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </header>
  );
}
