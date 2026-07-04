import { KeyboardEvent } from 'react';
import { GroupedSessions } from '@/components/SessionList/utils';
import { SearchInput } from '@/components/SessionList/SearchInput';
import { SessionList } from '@/components/SessionList';
import { isMobile } from '@/config/environment';

interface Props {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  groupedSessions: GroupedSessions;
  filteredSessionsCount: number;
  currentSessionId: string | null;
  highlightedSessionId?: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
}

export function DropdownMenu(props: Props) {
  const {
    searchQuery,
    onSearchChange,
    onSearchKeyDown,
    groupedSessions,
    filteredSessionsCount,
    currentSessionId,
    highlightedSessionId = null,
    onSelectSession,
    onDeleteSession,
    onRenameSession,
  } = props;

  return (
    <div className={`absolute top-full mt-1 bg-surface-raised border border-border-default rounded-md shadow-xl overflow-hidden z-50 ${isMobile() ? 'left-2 right-2' : 'left-0 w-[23rem]'}`}>
      <SearchInput value={searchQuery} onChange={onSearchChange} onKeyDown={onSearchKeyDown} />

      {filteredSessionsCount > 0 ? (
        <SessionList
          groupedSessions={groupedSessions}
          currentSessionId={currentSessionId}
          highlightedSessionId={highlightedSessionId}
          onSelectSession={onSelectSession}
          onDeleteSession={onDeleteSession}
          onRenameSession={onRenameSession}
        />
      ) : (
        <div className="px-2.5 py-3 text-xs text-text-tertiary text-center">
          {searchQuery.trim() ? 'No matching sessions' : 'No sessions yet'}
        </div>
      )}
    </div>
  );
}
