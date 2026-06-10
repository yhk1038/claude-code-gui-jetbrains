import { GroupedSessions } from './utils';
import { SearchInput } from './SearchInput';
import { SessionList } from './SessionList';

interface Props {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  groupedSessions: GroupedSessions;
  filteredSessionsCount: number;
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
}

export function DropdownMenu(props: Props) {
  const {
    searchQuery,
    onSearchChange,
    groupedSessions,
    filteredSessionsCount,
    currentSessionId,
    onSelectSession,
    onDeleteSession,
    onRenameSession,
  } = props;

  return (
    <div className="absolute left-0 top-full mt-1 w-[23rem] bg-surface-raised border border-border-default rounded-md shadow-xl overflow-hidden z-50">
      <SearchInput value={searchQuery} onChange={onSearchChange} />

      {filteredSessionsCount > 0 ? (
        <SessionList
          groupedSessions={groupedSessions}
          currentSessionId={currentSessionId}
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
