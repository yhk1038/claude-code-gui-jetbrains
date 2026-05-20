import { FolderIcon } from '@heroicons/react/24/outline';
import { useSessionContext } from '@/contexts/SessionContext';
import { useWorkingDir } from '@/contexts/WorkingDirContext';
import { SessionState } from '@/types';
import { isBrowser } from '@/config/environment';

export function ProjectButton() {
  const { sessionState, setSessionState } = useSessionContext();
  const { setWorkingDirectory } = useWorkingDir();

  if (!isBrowser()) return null;

  const isSessionActive =
    sessionState === SessionState.Streaming || sessionState === SessionState.WaitingPermission;

  const handleClick = () => {
    setSessionState(SessionState.Idle);
    setWorkingDirectory(null, { replace: !isBrowser() });
  };

  return (
    <button
      onClick={isSessionActive ? undefined : handleClick}
      disabled={isSessionActive}
      className={[
        'p-1 rounded transition-colors text-text-secondary',
        isSessionActive
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:text-text-primary hover:bg-surface-hover',
      ].join(' ')}
      title={isSessionActive ? 'Cannot switch project while session is active' : 'Switch Project'}
    >
      <FolderIcon className="w-5 h-5" />
    </button>
  );
}
