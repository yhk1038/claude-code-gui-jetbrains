import { useState, useRef, useEffect } from 'react';
import { DropdownToggle } from './DropdownToggle';
import { DropdownMenu } from './DropdownMenu';
import { useSessionContext } from '@/contexts/SessionContext';
import { useSessionList } from '@/components/SessionList/useSessionList';
import { OPEN_SESSION_DROPDOWN_EVENT } from '@/commandPalette/sections/context/items';

export function SessionDropdown() {
  const { currentSession, switchSession } = useSessionContext();
  const {
    currentSessionId,
    searchQuery,
    setSearchQuery,
    filteredSessions,
    groupedSessions,
    handleDeleteSession,
    renameSession,
    confirmDialog,
  } = useSessionList();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sessionTitle = currentSession?.title || 'Past Conversations';

  // `/resume` slash command opens the dropdown so past conversations can be
  // browsed and resumed. Issue #28.
  useEffect(() => {
    const handleOpenFromPalette = () => {
      setSearchQuery('');
      setIsOpen(true);
    };
    window.addEventListener(OPEN_SESSION_DROPDOWN_EVENT, handleOpenFromPalette);
    return () => window.removeEventListener(OPEN_SESSION_DROPDOWN_EVENT, handleOpenFromPalette);
  }, [setSearchQuery]);

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
  }, [isOpen, setSearchQuery]);

  const handleSelectSession = (sessionId: string) => {
    switchSession(sessionId);
    setIsOpen(false);
    setSearchQuery('');
  };

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
          onRenameSession={renameSession}
        />
      )}

      {confirmDialog}
    </div>
  );
}
