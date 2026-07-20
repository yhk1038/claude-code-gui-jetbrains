import { ContextUsageCategory } from '@/utils/parseContextUsage';

/**
 * Fixed dataviz palette assigned to categories by stable index. Each entry is a
 * *literal* Tailwind class (so the JIT compiler emits it) used for both grid-cell
 * fills and legend swatches. The 500-level hues stay legible on both the light
 * and dark surfaces the card renders against.
 */
export const CATEGORY_COLORS: string[] = [
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-pink-500',
  'bg-lime-500',
  'bg-fuchsia-500',
];

/** Muted fill for the unused portion of the window ("Free space" cells). */
export const FREE_CELL_CLASS = 'bg-surface-sunken border border-border-subtle';

/** Case-insensitive match for the CLI's "Free space" category row. */
export function isFreeSpace(name: string): boolean {
  return name.trim().toLowerCase() === 'free space';
}

/** Resolve a category's fill class from its palette index (wraps if exhausted). */
export function colorForIndex(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

export interface CategoryCells extends ContextUsageCategory {
  /** Number of grid cells allotted to this category. */
  cells: number;
  /** Palette fill class, or the free-space class for the free row. */
  colorClass: string;
  /** True for the "Free space" row so the card can style/label it apart. */
  free: boolean;
}

export interface GridAllocation {
  segments: CategoryCells[];
  freeCells: number;
  totalCells: number;
}

/**
 * Allocate `totalCells` across the categories proportionally to their token
 * counts. Non-free categories with any tokens get at least one cell so they stay
 * visible; whatever remains becomes free space. Palette colors are assigned by
 * the order of *used* categories, independent of where "Free space" sits.
 */
export function allocateGridCells(
  categories: ContextUsageCategory[],
  totalTokens: number,
  totalCells: number,
): GridAllocation {
  const denominator = totalTokens > 0 ? totalTokens : Math.max(sumTokens(categories), 1);
  const segments: CategoryCells[] = [];
  let paletteIndex = 0;

  for (const category of categories) {
    if (isFreeSpace(category.name)) continue;
    const ideal = (category.tokens / denominator) * totalCells;
    const cells = category.tokens > 0 ? Math.max(1, Math.round(ideal)) : 0;
    segments.push({
      ...category,
      cells,
      colorClass: colorForIndex(paletteIndex),
      free: false,
    });
    paletteIndex += 1;
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
