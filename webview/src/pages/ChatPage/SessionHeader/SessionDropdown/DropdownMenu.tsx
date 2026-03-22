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
  } = props;

  return (
    <div className="absolute left-0 top-full mt-1 w-[23rem] bg-zinc-900 border border-zinc-700 rounded-md shadow-xl overflow-hidden z-50">
      <SearchInput value={searchQuery} onChange={onSearchChange} />

      {filteredSessionsCount > 0 ? (
        <SessionList
          groupedSessions={groupedSessions}
          currentSessionId={currentSessionId}
          onSelectSession={onSelectSession}
          onDeleteSession={onDeleteSession}
        />
      ) : (
        <div className="px-2.5 py-3 text-xs text-zinc-500 text-center">
          {searchQuery.trim() ? 'No matching sessions' : 'No sessions yet'}
        </div>
      )}
    </div>
  );
}
