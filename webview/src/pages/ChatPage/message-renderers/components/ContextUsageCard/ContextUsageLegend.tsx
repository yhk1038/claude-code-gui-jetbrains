import React from 'react';
import { CELL_FILLED, CELL_FREE, ColoredCategory } from './palette';

interface Props {
  categories: ColoredCategory[];
}

/** Formats a percentage without trailing noise: 0.2 → "0.2%", 94 → "94%". */
function formatPercent(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  return `${rounded}%`;
}

/**
 * The per-category legend beneath the "Estimated usage by category" subheading,
 * mirroring the native TUI line: a color marker, the category name, its token
 * count and share. Categories keep the CLI's original order. "Free space" omits
 * the "tokens" word and uses the muted free-cell marker, exactly as the terminal
 * prints it.
 */
export const ContextUsageLegend: React.FC<Props> = (props: Props) => {
  return (
    <ul className="flex flex-col gap-0.5">
      {props.categories.map((category) => (
        <li
          key={category.name}
          className="flex items-center gap-1.5 font-ide-code text-[0.75rem] leading-snug"
        >
          <span className={`shrink-0 select-none ${category.colorClass}`} aria-hidden="true">
            {category.free ? CELL_FREE : CELL_FILLED}
          </span>
          <span className="min-w-0 truncate text-text-secondary">
            <span className="text-text-primary">{category.name}</span>
            <span className="text-text-tertiary">
              {': '}
              {category.tokensLabel}
              {category.free ? '' : ' tokens'}
              {' ('}
              {formatPercent(category.percent)}
              {')'}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
};
