import { useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '@/i18n';
import { useUsageReport } from '@/hooks/queries/useUsageReport';
import { SectionLabel } from './SectionLabel';
import { SkeletonRow } from './SkeletonRow';

/**
 * "Contributing to usage" — the detailed breakdown parsed from `claude -p
 * "/usage"` (subagent-heavy %, >150k context %, top skills/subagents/plugins/MCP
 * per period). Complements the ccb-backed session/weekly bars in UsageSection.
 */
export function UsageReportSection() {
  const { t } = useTranslation('common');
  const { data, isLoading, error, refresh } = useUsageReport(true);
  const [tab, setTab] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const report = data?.report ?? null;
  const periods = report?.periods ?? [];
  const activeIndex = Math.min(tab, Math.max(periods.length - 1, 0));
  const active = periods[activeIndex];

  return (
    <div>
      <SectionLabel className="flex items-center justify-between">
        <div>{t('usageReport.title')}</div>
        <button
          onClick={() => void handleRefresh()}
          disabled={isRefreshing}
          className="p-1 rounded hover:bg-surface-hover transition-colors disabled:opacity-40 normal-case"
          title={t('usageReport.refresh')}
        >
          <ArrowPathIcon className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </SectionLabel>

      {isLoading ? (
        <>
          <SkeletonRow />
          <SkeletonRow />
        </>
      ) : !report || periods.length === 0 ? (
        <p className="text-xs text-text-tertiary">
          {data?.error ?? error?.message ?? t('usageReport.empty')}
        </p>
      ) : (
        <>
          {periods.length > 1 && (
            <div className="flex gap-1 mb-3">
              {periods.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => setTab(i)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    i === activeIndex
                      ? 'bg-surface-overlay text-text-primary'
                      : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {active && (
            <div className="space-y-3">
              {(active.requests !== null || active.sessions !== null) && (
                <div className="text-xs text-text-tertiary">
                  {[
                    active.requests !== null ? t('usageReport.requests', { value: active.requests.toLocaleString() }) : null,
                    active.sessions !== null ? t('usageReport.sessions', { value: active.sessions.toLocaleString() }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}

              {active.insights.length > 0 && (
                <ul className="space-y-1.5">
                  {active.insights.map((insight, i) => (
                    <li key={i} className="text-xs text-text-secondary leading-snug">
                      {insight}
                    </li>
                  ))}
                </ul>
              )}

              {active.breakdowns.map((breakdown) => (
                <div key={breakdown.title}>
                  <div className="flex items-center justify-between text-[0.7rem] uppercase tracking-wide text-text-tertiary mb-1">
                    <span>{breakdown.title.replace(/^Top /, '')}</span>
                    <span>{t('usageReport.percentOfUsage')}</span>
                  </div>
                  <div className="space-y-0.5">
                    {breakdown.items.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary truncate me-2">{item.name}</span>
                        <span className="text-text-primary flex-shrink-0">{item.percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
