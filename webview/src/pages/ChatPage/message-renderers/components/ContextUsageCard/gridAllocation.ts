import { ContextUsageCategory } from '@/utils/parseContextUsage';
import { ColoredCategory, assignCategoryColors, isFreeSpace } from './palette';

export interface CategoryCells extends ColoredCategory {
  /** Number of grid cells allotted to this category. */
  cells: number;
}

export interface GridAllocation {
  segments: CategoryCells[];
  freeCells: number;
  totalCells: number;
}

/**
 * Allocate `totalCells` across the categories proportionally to their token
 * counts. Non-free categories with any tokens get at least one cell so they stay
 * visible; whatever remains becomes free space. Colors come from
 * `assignCategoryColors`, so the grid mosaic matches the legend markers exactly.
 */
export function allocateGridCells(
  categories: ContextUsageCategory[],
  totalTokens: number,
  totalCells: number,
): GridAllocation {
  const colored = assignCategoryColors(categories);
  const denominator = totalTokens > 0 ? totalTokens : Math.max(sumTokens(categories), 1);
  const segments: CategoryCells[] = [];

  for (const category of colored) {
    if (category.free) continue;
    const ideal = (category.tokens / denominator) * totalCells;
    const cells = category.tokens > 0 ? Math.max(1, Math.round(ideal)) : 0;
    segments.push({ ...category, cells });
  }

  // Never overrun the grid: trim from the largest segments if rounding overflowed.
  trimOverflow(segments, totalCells);
  const usedCells = segments.reduce((sum, seg) => sum + seg.cells, 0);
  const freeCells = Math.max(0, totalCells - usedCells);

  return { segments, freeCells, totalCells };
}

function sumTokens(categories: ContextUsageCategory[]): number {
  return categories
    .filter((c) => !isFreeSpace(c.name))
    .reduce((sum, c) => sum + (Number.isFinite(c.tokens) ? c.tokens : 0), 0);
}

function trimOverflow(segments: CategoryCells[], totalCells: number): void {
  let overflow = segments.reduce((sum, seg) => sum + seg.cells, 0) - totalCells;
  if (overflow <= 0) return;
  const byCells = [...segments].sort((a, b) => b.cells - a.cells);
  let i = 0;
  while (overflow > 0 && byCells.some((seg) => seg.cells > 1)) {
    const seg = byCells[i % byCells.length];
    if (seg.cells > 1) {
      seg.cells -= 1;
      overflow -= 1;
    }
    i += 1;
  }
}
