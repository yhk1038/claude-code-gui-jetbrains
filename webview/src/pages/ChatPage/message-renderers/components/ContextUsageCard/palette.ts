import { ContextUsageCategory } from '@/utils/parseContextUsage';

/**
 * The native `/context` TUI paints its grid with Unicode block glyphs, not
 * filled rectangles: a "database" symbol for used cells and an empty-square
 * symbol for free space. We reproduce the exact code points so a monospace font
 * renders the same texture.
 */
export const CELL_FILLED = '⛁'; // ⛁ used cell
export const CELL_FREE = '⛶'; // ⛶ free-space cell

/**
 * Category palette echoing the native `/context` TUI: muted, earthy hues rather
 * than saturated data-viz primaries, each visually distinct so no two categories
 * collide. Because the grid draws *glyphs* (not backgrounds), the color is applied
 * as the text color — hence `text-[#…]` classes. Entries are *literal* arbitrary
 * Tailwind classes so the JIT compiler statically emits them; runtime-built
 * strings would be dropped by Tailwind's static scan. The same class colors both
 * the grid glyph and the legend marker so the two always agree.
 */
export const CATEGORY_COLORS: string[] = [
  'text-[#c69c6d]', // warm tan
  'text-[#6b9bd1]', // muted blue
  'text-[#90a4bd]', // slate blue
  'text-[#9b8bc4]', // muted violet
  'text-[#cf7d6b]', // terracotta
  'text-[#7fae8c]', // sage green
  'text-[#c2a24a]', // muted gold
  'text-[#c283a6]', // mauve
  'text-[#7bb0a8]', // muted teal
  'text-[#b7855f]', // clay
];

/** Muted glyph color for the unused portion of the window ("Free space" cells). */
export const FREE_CELL_CLASS = 'text-text-tertiary';

/** Case-insensitive match for the CLI's "Free space" category row. */
export function isFreeSpace(name: string): boolean {
  return name.trim().toLowerCase() === 'free space';
}

/** Resolve a category's fill class from its palette index (wraps if exhausted). */
export function colorForIndex(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

export interface ColoredCategory extends ContextUsageCategory {
  /** Palette fill class, or the free-space class for the free row. */
  colorClass: string;
  /** True for the "Free space" row so the card can style/label it apart. */
  free: boolean;
}

/**
 * Assign a color to every category, preserving the CLI's original row order.
 * "Free space" always gets the muted free-cell class; every other category is
 * colored by its position among the *used* categories, so the grid and legend
 * share one source of truth for which hue means which category.
 */
export function assignCategoryColors(categories: ContextUsageCategory[]): ColoredCategory[] {
  let usedIndex = 0;
  return categories.map((category) => {
    if (isFreeSpace(category.name)) {
      return { ...category, colorClass: FREE_CELL_CLASS, free: true };
    }
    const colorClass = colorForIndex(usedIndex);
    usedIndex += 1;
    return { ...category, colorClass, free: false };
  });
}
