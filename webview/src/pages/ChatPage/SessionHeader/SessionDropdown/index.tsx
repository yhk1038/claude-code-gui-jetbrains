import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { groupSessionsByDate } from './utils';
import { DropdownToggle } from './DropdownToggle';
import { DropdownMenu } from './DropdownMenu';
import { useSessionContext } from '@/contexts/SessionContext';
import { useConfirmDialog } from '@/components/ConfirmDialog/useConfirmDialog';

export function SessionDropdown() {
  const { sessions, currentSessionId, currentSession, switchSession, deleteSession } = useSessionContext();
  const { confirmDialog, confirm } = useConfirmDialog();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sessionTitle = currentSession?.title || 'Past Conversations';

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
    switchSession(sessionId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    const confirmed = await confirm({
      title: 'Delete Session',
      message: `Are you sure you want to delete "${session?.title ?? sessionId}"?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (confirmed) {
      await deleteSession(sessionId);
    }
  }, [sessions, confirm, deleteSession]);

  return (
    <div className="relative min-w-0" ref={dropdownRef}>
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
          onDeleteSession={handleDeleteSession}
        />
      )}

      {confirmDialog}
    </div>
  );
}
