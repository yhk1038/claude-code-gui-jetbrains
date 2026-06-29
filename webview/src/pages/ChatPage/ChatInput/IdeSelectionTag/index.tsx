import { useIdeSelectionContext } from '@/contexts/IdeSelectionContext';
import { Tag } from '../Tag';
import { basename } from '../basename';
import type { IdeSelectionPayload } from '@/hooks/useIdeSelection';

/** File icon — selection is included in the next send (matches Cursor). */
function FileIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

/** Eye-off icon — selection is excluded from the next send. */
function EyeOffIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

/**
 * The label for the chip: line range when a selection exists, otherwise the
 * file's basename. Examples: `file.ts:42-51`, `file.ts`.
 */
function selectionLabel(selection: IdeSelectionPayload): string {
  const name = basename(selection.relativePath);
  if (typeof selection.startLine === 'number' && typeof selection.endLine === 'number') {
    return `${name}:${selection.startLine}-${selection.endLine}`;
  }
  return name;
}

/**
 * Composer tag showing the IDE's current open file / selection. Clicking it
 * toggles whether the IDE-context tag is prepended to the next message (file
 * icon = included, eye-off = excluded). Renders nothing when there is no
 * selection. Shares the footer {@link Tag} styling with its sibling tags.
 */
export function IdeSelectionTag() {
  const { currentSelection, includeSelection, toggleIncludeSelection } = useIdeSelectionContext();

  if (!currentSelection) return null;

  const label = selectionLabel(currentSelection);
  const title = includeSelection
    ? `Including ${currentSelection.relativePath} in the next message — click to exclude`
    : `Excluding ${currentSelection.relativePath} — click to include`;

  return (
    <Tag
      onClick={toggleIncludeSelection}
      title={title}
      aria-pressed={includeSelection}
      className={includeSelection ? undefined : 'text-text-tertiary'}
    >
      {includeSelection ? <FileIcon /> : <EyeOffIcon />}
      <span className="truncate max-w-[160px]">{label}</span>
    </Tag>
  );
}
