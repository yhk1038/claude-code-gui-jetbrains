import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useLocation } from 'react-router-dom';
import { useRouter } from '@/router';
import { Label, ROUTE_META, Route } from '@/router/routes';

export function SettingsHeader() {
  const { goBack, navigate } = useRouter();
  const location = useLocation();
  const meta = ROUTE_META[Route.SETTINGS];

  // Settings can be opened either in-tab (gear button → history push) or as a
  // fresh tab (command palette → new editor/window). In the latter case there is
  // no history to pop, so fall back to a new session instead of a dead no-op.
  const onBack = () => {
    if (location.key === 'default') {
      navigate(Route.NEW_SESSION);
    } else {
      goBack();
    }
  };

  return (
    <header className="flex items-center gap-2 px-2 py-1 border-b border-border-default">
      <button
        onClick={onBack}
        className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
        title={Label.BACK}
      >
        <ArrowLeftIcon className="w-4 h-4" />
      </button>
      <h1 className="text-sm font-semibold text-text-primary">{meta.label}</h1>
    </header>
  );
}
