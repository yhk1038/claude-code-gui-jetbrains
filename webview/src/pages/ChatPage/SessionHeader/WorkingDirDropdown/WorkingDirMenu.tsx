import { Link } from 'react-router-dom';
import { Route, routeToPath } from '@/router/routes';
import { ClassifiedWorkingDirs, WorkingDirEntry } from './classifyWorkingDirs';
import { TreeGlyph, WorkingDirItem } from './WorkingDirItem';

interface Props {
  classified: ClassifiedWorkingDirs;
  currentPath: string | null;
  ideRoot: string | null;
  isLoading: boolean;
  onNavigate: () => void;
  onAddWorkingDir: () => void;
}

interface DisplayNode {
  entry: WorkingDirEntry;
  depth: number;
  glyph: TreeGlyph;
  isCurrent: boolean;
  isIdeRoot: boolean;
  isDraft: boolean;
}

function pathSegments(path: string): number {
  return path.split('/').filter(Boolean).length;
}

/**
 * Flatten the classified entries into a depth-tagged list with tree glyphs.
 *
 * Layout order, top to bottom:
 *   1. IDE root (★ anchor) — unless [current] IS the IDE root
 *   2. ancestors chain — each is the only child at its depth, so they all
 *      render `└─`
 *   3. parent's children (siblings + current), sorted by path. Each gets
 *      `├─` or `└─` based on its position. The [current] entry within this
 *      group is highlighted as selected.
 *   4. current's direct descendants, indented under [current].
 *
 * Depth is real path-segment depth relative to the shallowest visible node,
 * so a `webview/` sitting under the IDE root nests one step.
 */
function buildDisplayNodes(
  classified: ClassifiedWorkingDirs,
  currentPath: string | null,
): DisplayNode[] {
  const { ancestors, current, siblings, descendants, ideRootEntry, currentIsDraft } = classified;

  const topAnchor =
    ideRootEntry ?? ancestors[0] ?? current ?? siblings[0] ?? descendants[0] ?? null;
  if (!topAnchor) return [];
  const baseDepth = pathSegments(topAnchor.path);

  const nodes: DisplayNode[] = [];

  if (ideRootEntry && ideRootEntry.path !== currentPath) {
    nodes.push({
      entry: ideRootEntry,
      depth: 0,
      glyph: null,
      isCurrent: false,
      isIdeRoot: true,
      isDraft: false,
    });
  }

  ancestors.forEach((entry) => {
    const depth = Math.max(0, pathSegments(entry.path) - baseDepth);
    nodes.push({
      entry,
      depth,
      glyph: depth === 0 ? null : 'last',
      isCurrent: false,
      isIdeRoot: false,
      isDraft: false,
    });
  });

  if (current) {
    const merged: WorkingDirEntry[] = [...siblings, current].sort((a, b) =>
      a.path.localeCompare(b.path),
    );

    merged.forEach((entry, idx) => {
      const isCurrentRow = entry.path === current.path;
      const isLast = idx === merged.length - 1;
      const depth = Math.max(0, pathSegments(entry.path) - baseDepth);

      nodes.push({
        entry,
        depth,
        glyph: depth === 0 ? null : isLast ? 'last' : 'mid',
        isCurrent: isCurrentRow,
        isIdeRoot: ideRootEntry?.path === entry.path,
        isDraft: isCurrentRow && currentIsDraft,
      });

      if (isCurrentRow) {
        descendants.forEach((desc, dIdx) => {
          const dLast = dIdx === descendants.length - 1;
          const dDepth = Math.max(0, pathSegments(desc.path) - baseDepth);
          nodes.push({
            entry: desc,
            depth: dDepth,
            glyph: dDepth === 0 ? null : dLast ? 'last' : 'mid',
            isCurrent: false,
            isIdeRoot: false,
            isDraft: false,
          });
        });
      }
    });
  }

  return nodes;
}

export function WorkingDirMenu(props: Props) {
  const { classified, currentPath, isLoading, onNavigate, onAddWorkingDir } = props;
  const nodes = buildDisplayNodes(classified, currentPath);

  const handleFooterClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    onNavigate();
  };

  return (
    <div
      className="absolute left-0 top-full mt-1 w-[22rem] bg-surface-raised border border-border-default rounded-md shadow-xl overflow-hidden z-50"
      role="menu"
    >
      {isLoading && nodes.length === 0 ? (
        <div className="px-2.5 py-3 text-xs text-text-tertiary text-center">
          Loading…
        </div>
      ) : nodes.length === 0 ? (
        <div className="px-2.5 py-3 text-xs text-text-tertiary text-center">
          No working directories found
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto py-1">
          {nodes.map((node) => (
            <WorkingDirItem
              key={node.entry.path}
              entry={node.entry}
              depth={node.depth}
              glyph={node.glyph}
              isCurrent={node.isCurrent}
              isIdeRoot={node.isIdeRoot}
              isDraft={node.isDraft}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}

      <div className="w-full grid grid-cols-2 text-xs text-text-secondary border-t border-border-default">
        <Link
          to={routeToPath(Route.PROJECT_SELECTOR)}
          onClick={handleFooterClick}
          className="px-2.5 py-2 hover:text-text-primary hover:bg-[var(--surface-hover)] border-r border-border-default"
        >
          <span className="block text-center scale-90">Browse all…</span>
        </Link>

        <button
          type="button"
          onClick={onAddWorkingDir}
          className="px-2.5 py-2 hover:text-text-primary hover:bg-[var(--surface-hover)]"
        >
          <span className="block text-center scale-90">+ Add new</span>
        </button>
      </div>
    </div>
  );
}
