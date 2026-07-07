import { Link } from 'react-router-dom';
import { Route, routeToPath, withWorkingDir } from '@/router/routes';
import { WorkingDirEntry } from './classifyWorkingDirs';
import { useTranslation } from '@/i18n';
import type { TFunction } from 'i18next';

export type TreeGlyph = 'mid' | 'last' | null;

interface Props {
  entry: WorkingDirEntry;
  /**
   * Tree depth relative to the highest visible ancestor (0 = top of the
   * rendered tree). Drives left padding to express the nesting visually.
   */
  depth: number;
  /**
   * Tree branch glyph for this row:
   * - 'mid'  → ├─ (has more siblings below at the same depth)
   * - 'last' → └─ (last sibling at this depth)
   * - null   → root row, no glyph
   */
  glyph: TreeGlyph;
  isCurrent: boolean;
  isIdeRoot: boolean;
  /**
   * Synthesized current row — the user picked the folder but no Claude session
   * has been started there yet. Replaces the session-count slot with a "Draft"
   * badge so the user knows this working dir only becomes permanent after a
   * session runs.
   */
  isDraft: boolean;
  onNavigate: () => void;
}

// Tailwind can't generate `ps-{n}` from runtime values, so we pre-pick a small
// palette of widening steps. Anything deeper than the array length is clamped
// — extra nesting still groups visually under its parent.
const DEPTH_PADDING = ['ps-2.5', 'ps-6', 'ps-9', 'ps-12', 'ps-15', 'ps-18'];

function depthClass(depth: number): string {
  const clamped = Math.max(0, Math.min(depth, DEPTH_PADDING.length - 1));
  return DEPTH_PADDING[clamped];
}

function TreeBranch({ glyph }: { glyph: TreeGlyph }) {
  if (glyph === null) return null;
  return (
    <span
      className="font-mono text-text-tertiary select-none whitespace-pre"
      aria-hidden="true"
    >
      {glyph === 'last' ? '└─ ' : '├─ '}
    </span>
  );
}

function CountSlot({ entry, isDraft, t }: { entry: WorkingDirEntry; isDraft: boolean; t: TFunction }) {
  if (isDraft) {
    return (
      <span
        className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-overlay text-text-tertiary"
        title={t('sessionHeader.workingDir.draftBadgeTitle')}
      >
        {t('sessionHeader.workingDir.draftBadge')}
      </span>
    );
  }
  return <span className="text-text-tertiary tabular-nums">{entry.sessionCount}</span>;
}

export function WorkingDirItem(props: Props) {
  const { entry, depth, glyph, isCurrent, isIdeRoot, isDraft, onNavigate } = props;
  const { t } = useTranslation('chat');
  const href = withWorkingDir(routeToPath(Route.NEW_SESSION), entry.path);
  const padding = depthClass(depth);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Modifier-key clicks (cmd/ctrl/shift/middle) fall through to the host
    // default, which is "open in new tab" on supported shells. Only plain
    // left-clicks close the dropdown via SPA navigation.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    onNavigate();
  };

  if (isCurrent) {
    return (
      <div
        className={[
          'flex items-center gap-1.5 py-1.5 pe-2.5 text-xs cursor-default',
          padding,
          'text-text-primary bg-[var(--surface-selected)] font-medium',
        ].join(' ')}
        aria-current="true"
      >
        <TreeBranch glyph={glyph} />
        {isIdeRoot && (
          <span className="text-accent-default" title={t('sessionHeader.workingDir.ideRootTitle')} aria-hidden="true">
            ★
          </span>
        )}
        <span className="flex-1 truncate">{entry.name}</span>
        <CountSlot entry={entry} isDraft={isDraft} t={t} />
      </div>
    );
  }

  return (
    <Link
      to={href}
      onClick={handleClick}
      className={[
        'flex items-center gap-1.5 py-1.5 pe-2.5 text-xs text-text-secondary',
        padding,
        'hover:text-text-primary hover:bg-[var(--surface-hover)]',
      ].join(' ')}
    >
      <TreeBranch glyph={glyph} />
      {isIdeRoot && (
        <span className="text-accent-default" title={t('sessionHeader.workingDir.ideRootTitle')} aria-hidden="true">
          ★
        </span>
      )}
      <span className="flex-1 truncate">{entry.name}</span>
      <CountSlot entry={entry} isDraft={isDraft} t={t} />
    </Link>
  );
}
