import { useState } from 'react';
import { SessionMetaDto } from '@/dto';
import { getRelativeTime } from './utils';

interface Props {
  session: SessionMetaDto;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function SessionItem(props: Props) {
  const { session, isSelected, onSelect, onDelete } = props;
  const [isHovered, setIsHovered] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`w-full px-2 py-1.5 text-left text-xs rounded transition-colors flex justify-between items-center gap-2 ${
        isSelected
          ? 'text-text-primary bg-[var(--surface-selected)]'
          : 'text-text-secondary hover:text-text-primary hover:bg-[var(--surface-selected)]'
      }`}
      title={session.title}
    >
      <span className="truncate flex-1">{session.title}</span>
      {isHovered ? (
        <span
          role="button"
          onClick={handleDelete}
          className="flex-shrink-0 text-text-tertiary hover:text-state-error-fg transition-colors flex items-center justify-center"
          title="Delete session"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1.5 3h9M4.5 3V2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M2.5 3l.5 7a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5l.5-7"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 5.5v3M7 5.5v3"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
        </span>
      ) : session.updatedAt ? (
        <span className="flex-shrink-0 text-[0.8461rem] text-text-tertiary">
          {getRelativeTime(session.updatedAt)}
        </span>
      ) : null}
    </button>
  );
}
