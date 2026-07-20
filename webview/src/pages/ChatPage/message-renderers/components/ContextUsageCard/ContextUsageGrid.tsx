import React from 'react';
import { CELL_FILLED, CELL_FREE, FREE_CELL_CLASS } from './palette';
import { GridAllocation } from './gridAllocation';

interface Props {
  allocation: GridAllocation;
}

interface Cell {
  key: string;
  className: string;
  symbol: string;
  title: string;
}

/** Grid width in glyphs per row, matching the dense native terminal block. */
const COLUMNS = 20;

/** Flatten the allocation into an ordered list of glyph cells + free cells. */
function buildCells(allocation: GridAllocation): Cell[] {
  const cells: Cell[] = [];
  for (const segment of allocation.segments) {
    for (let i = 0; i < segment.cells; i++) {
      cells.push({
        key: `${segment.name}-${i}`,
        className: segment.colorClass,
        symbol: CELL_FILLED,
        title: `${segment.name} · ${segment.tokensLabel}`,
      });
    }
  }
  for (let i = 0; i < allocation.freeCells; i++) {
    cells.push({
      key: `free-${i}`,
      className: FREE_CELL_CLASS,
      symbol: CELL_FREE,
      title: 'Free space',
    });
  }
  return cells;
}

/** Split the flat cell list into fixed-width rows. */
function toRows(cells: Cell[]): Cell[][] {
  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += COLUMNS) {
    rows.push(cells.slice(i, i + COLUMNS));
  }
  return rows;
}

/**
 * The context-window grid, faithful to the native TUI: a dense block of Unicode
 * glyphs drawn in a monospace font — `⛁` for used cells (tinted with the owning
 * category's color) and `⛶` for free space (muted gray). The two glyphs have
 * different advance widths, so each cell is boxed to a fixed 11.5px width and its
 * glyph centered (with a matched 15px line-box), forcing every cell into a
 * regular matrix where columns line up regardless of which glyph fills them.
 */
export const ContextUsageGrid: React.FC<Props> = (props: Props) => {
  const rows = toRows(buildCells(props.allocation));

  return (
    <div
      className="w-fit select-none font-ide-code text-[12px]"
      role="img"
      aria-label="Context window usage grid"
    >
      {rows.map((row, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex">
          {row.map((cell) => (
            <span
              key={cell.key}
              title={cell.title}
              className={`inline-block h-[15px] w-[11.5px] text-center leading-[15px] ${cell.className}`}
            >
              {cell.symbol}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};
