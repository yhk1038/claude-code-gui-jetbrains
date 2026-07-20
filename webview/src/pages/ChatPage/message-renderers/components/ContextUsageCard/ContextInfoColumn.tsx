import React from 'react';
import { useTranslation } from '@/i18n';
import { ColoredCategory } from './palette';
import { ContextUsageLegend } from './ContextUsageLegend';

interface Props {
  /** Human model name resolved from the CLI catalog, e.g. "Opus 4.8 (1M context)". */
  displayName: string;
  /** Raw model id as the CLI printed it, e.g. "claude-opus-4-8[1m]". */
  modelId: string;
  /** Normalized token summary, e.g. "58.3k/1m tokens (6%)". */
  tokensSummary: string;
  /** Categories with their assigned colors, in the CLI's original order. */
  categories: ColoredCategory[];
}

/**
 * The right-hand information column of the context card, sitting beside the
 * usage grid: model name + id, the token summary, then the "Estimated usage by
 * category" subheading and its color legend — the same stack the native TUI
 * prints to the right of its grid.
 */
export const ContextInfoColumn: React.FC<Props> = (props: Props) => {
  const { t } = useTranslation('chat');

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {props.displayName && (
        <p className="text-sm font-semibold text-text-primary">{props.displayName}</p>
      )}
      {props.modelId && (
        <p className="font-ide-code text-xs text-text-tertiary">{props.modelId}</p>
      )}
      <p className="font-ide-code text-xs text-text-secondary tabular-nums">
        {props.tokensSummary}
      </p>

      <p className="mt-2 text-xs italic text-text-tertiary">
        {t('contextUsage.categoryHeading')}
      </p>
      <ContextUsageLegend categories={props.categories} />
    </div>
  );
};
