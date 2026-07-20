import React from 'react';
import { FREE_CELL_CLASS, GridAllocation } from './palette';

interface Props {
  allocation: GridAllocation;
}

interface Cell {
  key: string;
  className: string;
  title: string;
}

/** Flatten the allocation into an ordered list of colored cells + free cells. */
function buildCells(allocation: GridAllocation): Cell[] {
  const cells: Cell[] = [];
  for (const segment of allocation.segments) {
    for (let i = 0; i < segment.cells; i++) {
      cells.push({
        key: `${segment.name}-${i}`,
        className: segment.colorClass,
        title: `${segment.name} · ${segment.tokensLabel}`,
      });
    }
  }
  for (let i = 0; i < allocation.freeCells; i++) {
    cells.push({ key: `free-${i}`, className: FREE_CELL_CLASS, title: 'Free space' });
  }
  return cells;
}

/**
 * The context-window grid: an ordered mosaic of square cells, each category's
 * cells contiguous and colored, the remainder rendered as muted "free" cells.
 * A web-native reimagining of the native TUI's usage grid.
 */
export const ContextUsageGrid: React.FC<Props> = (props: Props) => {
  const cells = buildCells(props.allocation);

  return (
    <div
      className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px] rounded-md p-1"
      role="img"
      aria-label="Context window usage grid"
    >
      {cells.map((cell) => (
        <span
          key={cell.key}
          title={cell.title}
          className={`aspect-square rounded-[2px] ${cell.className}`}
        />
      ))}
    </div>
  );
};
