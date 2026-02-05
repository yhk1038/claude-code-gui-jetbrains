import { SessionMetaDto } from '@/dto';
import { SessionDropdown } from './SessionDropdown';

interface SessionHeaderProps {
  sessions: SessionMetaDto[];
  currentSessionId: string | null;
  sessionTitle: string;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
}

export function SessionHeader({
  sessions,
  currentSessionId,
  sessionTitle,
  onSelectSession,
  onCreateSession,
}: SessionHeaderProps) {
  const handleCreateSession = () => {
    onCreateSession();
  };

  return (
    <div className="flex justify-between items-center px-2 py-1">
      {/* Left: Session dropdown */}
      <SessionDropdown
        sessions={sessions}
        currentSessionId={currentSessionId}
        sessionTitle={sessionTitle}
        onSelectSession={onSelectSession}
      />

      {/* Right: New session button (disabled when in initialized session state) */}
      <button
        onClick={handleCreateSession}
        disabled={!currentSessionId}
        className={`p-1 rounded transition-colors ${
          currentSessionId
            ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            : 'text-zinc-600 cursor-not-allowed'
        }`}
        title={currentSessionId ? 'New Chat' : 'Already in new session'}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
