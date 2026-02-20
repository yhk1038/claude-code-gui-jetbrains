import { useSessionContext } from '@/contexts/SessionContext';
import { Label } from '@/router/routes';

export function NewTabButton() {
  const { openNewTab } = useSessionContext();

  return (
    <button
      id="new-tab-button"
      onClick={openNewTab}
      className="p-1 rounded transition-colors text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
      title={Label.NEW_TAB}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}
