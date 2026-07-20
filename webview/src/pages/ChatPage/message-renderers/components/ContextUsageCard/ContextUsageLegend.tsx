import React from 'react';
import { CategoryCells, FREE_CELL_CLASS } from './palette';

interface Props {
  segments: CategoryCells[];
  freeCategory: { name: string; tokensLabel: string; percent: number } | null;
}

interface LegendRow {
  key: string;
  swatchClass: string;
  name: string;
  tokensLabel: string;
  percent: number;
  muted: boolean;
}

function toRows(props: Props): LegendRow[] {
  const rows: LegendRow[] = props.segments.map((segment) => ({
    key: segment.name,
    swatchClass: segment.colorClass,
    name: segment.name,
    tokensLabel: segment.tokensLabel,
    percent: segment.percent,
    muted: false,
  }));
  if (props.freeCategory) {
    rows.push({
      key: 'free-space',
      swatchClass: FREE_CELL_CLASS,
      name: props.freeCategory.name,
      tokensLabel: props.freeCategory.tokensLabel,
      percent: props.freeCategory.percent,
      muted: true,
    });
  }
  return rows;
}

/** Formats a percentage without trailing noise: 0.2 → "0.2%", 94 → "94%". */
function formatPercent(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  return `${rounded}%`;
}

/** Color-swatch + name + tokens + percentage list, mirroring the grid colors. */
export const ContextUsageLegend: React.FC<Props> = (props: Props) => {
  const rows = toRows(props);

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-2 text-[0.8125rem]">
          <span
            className={`h-3 w-3 shrink-0 rounded-[3px] ${row.swatchClass}`}
            aria-hidden="true"
          />
          <span
            className={`flex-1 truncate ${row.muted ? 'text-text-tertiary' : 'text-text-primary'}`}
          >
            {row.name}
          </span>
          <span className="shrink-0 font-ide-code text-text-secondary tabular-nums">
            {row.tokensLabel}
          </span>
          <span className="w-12 shrink-0 text-right font-ide-code text-text-tertiary tabular-nums">
            {formatPercent(row.percent)}
          </span>
        </li>
      ))}
    </ul>
  );
};
