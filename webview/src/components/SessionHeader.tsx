import { api } from '@/api';
import { SessionMetaDto } from '@/dto';
import { useState, useRef, useEffect, useMemo } from 'react';

interface SessionHeaderProps {
  sessions: SessionMetaDto[];
  currentSessionId: string | null;
  sessionTitle: string;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

export function SessionHeader({
  sessions,
  currentSessionId,
  sessionTitle,
  onSelectSession,
  onCreateSession,
}: SessionHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Filter sessions using regex
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    try {
      const regex = new RegExp(searchQuery, 'i');
      return sessions.filter(s => regex.test(s.title));
    } catch {
      // Invalid regex, fall back to includes
      return sessions.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  }, [sessions, searchQuery]);

  const handleSelectSession = (sessionId: string) => {
    onSelectSession(sessionId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleCreateSession = () => {
    onCreateSession();
    setIsOpen(false);
  };

  return (
    <div className="flex justify-between items-center px-2 py-1">
      {/* Left: Session dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 px-2 py-0.5 text-[13px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50 rounded transition-colors"
        >
          <span className="max-w-[300px] truncate">{sessionTitle || 'New Chat'}</span>
          <svg
            className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M4.427 6.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 6H4.604a.25.25 0 0 0-.177.427z" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute left-0 top-full mt-1 w-72 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl overflow-hidden z-50">
            {/* Search input */}
            <div className="p-1.5">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-zinc-800 text-zinc-300 px-2.5 py-1.5 rounded outline-none placeholder:text-zinc-500"
                placeholder="Search sessions..."
                autoFocus
              />
            </div>

            {/* Session list */}
            {filteredSessions.length > 0 && (
              <div className="max-h-80 overflow-y-auto p-1.5 pt-0 flex flex-col gap-0.5">
                <div className="px-2 py-1.5 text-[11px] text-zinc-500" onClick={() => {
                  api.sessions.index().then((sessions) => {
                    console.log('sessions', sessions);
                  });
                }}>
                  Today
                </div>
                {filteredSessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    className={`w-full px-2 py-1.5 text-left text-xs rounded transition-colors flex justify-between items-center gap-2 ${
                      session.id === currentSessionId
                        ? 'text-zinc-100 bg-zinc-700/70'
                        : 'text-zinc-400 hover:bg-zinc-700/40'
                    }`}
                    title={session.title}
                  >
                    <span className="truncate flex-1">{session.title}</span>
                    {session.updatedAt && (
                      <span className="text-[11px] text-zinc-500 flex-shrink-0">
                        {getRelativeTime(session.updatedAt)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {filteredSessions.length === 0 && (
              <div className="px-2.5 py-3 text-xs text-zinc-500 text-center">
                {searchQuery.trim() ? 'No matching sessions' : 'No sessions yet'}
              </div>
            )}
          </div>
        )}
      </div>

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
