import React, { useMemo } from 'react';
import { useTranslation } from '@/i18n';
import {
  ContextUsage,
  extractContextDetailMarkdown,
  parseTokenValue,
} from '@/utils/parseContextUsage';
import { StreamingMessage } from '@/pages/ChatPage/StreamingMessage';
import { allocateGridCells, isFreeSpace } from './palette';
import { ContextUsageGrid } from './ContextUsageGrid';
import { ContextUsageLegend } from './ContextUsageLegend';

interface Props {
  data: ContextUsage;
  rawMarkdown: string;
}

/** Grid resolution: 24 columns × 8 rows ≈ 192 cells, a web-native take on the TUI grid. */
const TOTAL_CELLS = 192;

/**
 * Renders the `/context` report as the native TUI does: a colored usage grid with
 * a category legend, plus the model/token summary. The CLI's detail tables
 * (Custom Agents / Memory Files / Skills) are preserved verbatim below via
 * markdown, so no information from the original report is lost.
 */
export const ContextUsageCard: React.FC<Props> = (props: Props) => {
  const { t } = useTranslation('chat');
  const { data, rawMarkdown } = props;

  const totalTokens = useMemo(
    () => parseTokenValue(data.tokensTotalLabel),
    [data.tokensTotalLabel],
  );
  const allocation = useMemo(
    () => allocateGridCells(data.categories, totalTokens, TOTAL_CELLS),
    [data.categories, totalTokens],
  );
  const freeCategory = useMemo(
    () => data.categories.find((c) => isFreeSpace(c.name)) ?? null,
    [data.categories],
  );
  const detailMarkdown = useMemo(
    () => extractContextDetailMarkdown(rawMarkdown),
    [rawMarkdown],
  );

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border-default bg-surface-raised">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border-subtle px-4 py-3">
        <h3 className="text-[0.9375rem] font-semibold text-text-primary">
          {t('contextUsage.heading')}
        </h3>
        {data.model && (
          <span className="font-ide-code text-[0.8125rem] text-text-secondary">
            {data.model}
          </span>
        )}
      </header>

      <div className="px-4 pt-3">
        <p className="font-ide-code text-[0.8125rem] text-text-secondary tabular-nums">
          {t('contextUsage.tokensSummary', {
            used: data.tokensUsedLabel || '—',
            total: data.tokensTotalLabel || '—',
            percent: data.percentUsed,
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ContextUsageGrid allocation={allocation} />
        <ContextUsageLegend segments={allocation.segments} freeCategory={freeCategory} />
      </div>

      {detailMarkdown && (
        <div className="border-t border-border-subtle px-4 py-2">
          <StreamingMessage
            content={detailMarkdown}
            isStreaming={false}
            className="text-text-primary text-[0.9375rem] leading-relaxed"
          />
        </div>
      )}
    </div>
  );
};
