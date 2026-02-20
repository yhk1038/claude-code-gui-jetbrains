import { SessionDropdown } from './SessionDropdown';
import { SettingsButton } from './SettingsButton';
import { NewTabButton } from './NewTabButton';
import { useDocumentTitle } from '@/hooks';
import { useSessionContext } from '@/contexts/SessionContext';

export function SessionHeader() {
  const { currentSession } = useSessionContext();
  useDocumentTitle(currentSession?.title || null);

  return (
    <div className="flex justify-between items-center px-2 py-1">
      {/* Left: Session dropdown */}
      <div className="min-w-0 flex-1">
        <SessionDropdown />
      </div>

      {/* Right: buttons */}
      <div className="flex items-center gap-1">
        <SettingsButton />
        <NewTabButton />
      </div>
    </div>
  );
}
