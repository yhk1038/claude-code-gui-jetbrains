import { SessionMetaDto } from '@/dto';
import { getRelativeTime } from './utils';

interface SessionItemProps {
  session: SessionMetaDto;
  isSelected: boolean;
  onSelect: () => void;
}

export function SessionItem({ session, isSelected, onSelect }: SessionItemProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full px-2 py-1.5 text-left text-xs rounded transition-colors flex justify-between items-center gap-2 ${
        isSelected
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
  );
}
