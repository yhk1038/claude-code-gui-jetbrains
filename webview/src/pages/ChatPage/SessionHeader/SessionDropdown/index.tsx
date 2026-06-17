import { useState, useRef, useEffect, useMemo, KeyboardEvent } from 'react';
import { DropdownToggle } from './DropdownToggle';
import { DropdownMenu } from './DropdownMenu';
import { useSessionContext } from '@/contexts/SessionContext';
import { useSessionList } from '@/components/SessionList/useSessionList';
import { GROUP_ORDER } from '@/components/SessionList/utils';
import { useChatInputFocus } from '@/contexts/ChatInputFocusContext';
import { OPEN_SESSION_DROPDOWN_EVENT } from '@/commandPalette/sections/context/items';

export function SessionDropdown() {
  const { currentSession, switchSession, loadSessions } = useSessionContext();
  const { focus: focusComposer } = useChatInputFocus();
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
  // Keyboard-navigation cursor over the displayed session rows. -1 = no row
  // highlighted (caret rests in the search box).
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sessionTitle = currentSession?.title || 'Past Conversations';

  // Sessions in the exact order they render (group order, then within-group
  // order) so arrow-key navigation matches what the user sees.
  const orderedSessions = useMemo(
    () => GROUP_ORDER.flatMap((group) => groupedSessions[group]),
    [groupedSessions],
  );
  const highlightedSessionId =
    highlightedIndex >= 0 ? orderedSessions[highlightedIndex]?.id ?? null : null;

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  };

  // Reset the highlight whenever the filtered list changes so the cursor never
  // points past the end of the list.
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery]);

  // `/resume` slash command opens the dropdown so past conversations can be
  // browsed and resumed. Issue #28.
  useEffect(() => {
    const handleOpenFromPalette = () => {
      setSearchQuery('');
      setHighlightedIndex(-1);
      setIsOpen(true);
    };
    window.addEventListener(OPEN_SESSION_DROPDOWN_EVENT, handleOpenFromPalette);
    return () => window.removeEventListener(OPEN_SESSION_DROPDOWN_EVENT, handleOpenFromPalette);
  }, [setSearchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, setSearchQuery]);

  // While the dropdown is open, Cmd/Ctrl+Shift+P refreshes the session list
  // (same action as the refresh button in the search box).
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        loadSessions();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, loadSessions]);

  const handleSelectSession = (sessionId: string) => {
    switchSession(sessionId);
    closeDropdown();
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, orderedSessions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      const session = orderedSessions[highlightedIndex];
      if (session) {
        e.preventDefault();
        handleSelectSession(session.id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
      focusComposer();
    }
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
          onSearchKeyDown={handleSearchKeyDown}
          groupedSessions={groupedSessions}
          filteredSessionsCount={filteredSessions.length}
          currentSessionId={currentSessionId}
          highlightedSessionId={highlightedSessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={renameSession}
        />
      )}

      {confirmDialog}
    </div>
  );
}
