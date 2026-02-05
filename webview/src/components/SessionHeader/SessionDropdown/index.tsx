import { SessionMetaDto } from '@/dto';
import { useState, useRef, useEffect, useMemo } from 'react';
import { groupSessionsByDate } from './utils';
import { DropdownToggle } from './DropdownToggle';
import { DropdownMenu } from './DropdownMenu';

interface SessionDropdownProps {
  sessions: SessionMetaDto[];
  currentSessionId: string | null;
  sessionTitle: string;
  onSelectSession: (sessionId: string) => void;
}

export function SessionDropdown({
  sessions,
  currentSessionId,
  sessionTitle,
  onSelectSession,
}: SessionDropdownProps) {
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

  const groupedSessions = useMemo(() => {
    return groupSessionsByDate(filteredSessions);
  }, [filteredSessions]);

  const handleSelectSession = (sessionId: string) => {
    onSelectSession(sessionId);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <DropdownToggle
        sessionTitle={sessionTitle}
        isOpen={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      />

      {isOpen && (
        <DropdownMenu
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          groupedSessions={groupedSessions}
          filteredSessionsCount={filteredSessions.length}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
        />
      )}
    </div>
  );
}
