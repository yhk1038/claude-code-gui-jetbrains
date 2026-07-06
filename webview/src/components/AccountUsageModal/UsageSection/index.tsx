import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '@/i18n';
import {useUsageData} from "@/pages/SettingsPage/Usage/useUsageData";
import { CcbNotInstalledNotice } from '@/pages/SettingsPage/Usage/CcbNotInstalledNotice';
import { SectionLabel } from '../SectionLabel';
import { SkeletonRow } from '../SkeletonRow';
import { UsageRow } from '../UsageRow';
import { formatRelativeTime } from '../formatters';

interface Props {
    //
}

export const UsageSection = (props: Props) => {
    const {} = props;
    const { t } = useTranslation('common');
    const { data: usageData, isLoading: usageLoading, error: usageError, errorKind: usageErrorKind, lastUpdated, refresh } = useUsageData();

    return (
        <div>
            <SectionLabel className="flex items-center justify-between">
                <div>{t('usageSection.title')}</div>

                <div className="flex items-center gap-2 text-[0.8461rem] text-text-tertiary normal-case font-[400] hover:text-text-primary transition-all">
                    {lastUpdated && <span>{t('usageSection.updated', { time: formatRelativeTime(lastUpdated) })}</span>}
                    <button
                        onClick={refresh}
                        disabled={usageLoading}
                        className="p-1 rounded hover:bg-surface-hover transition-colors disabled:opacity-40"
                        title={t('usageSection.refresh')}
                    >
                        <ArrowPathIcon className={`w-3 h-3 ${usageLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </SectionLabel>

            {usageError && usageErrorKind === 'ccb_missing' ? (
                <CcbNotInstalledNotice onRetry={refresh} isLoading={usageLoading} />
            ) : usageError ? (
                <p className="text-xs text-state-error-fg mb-2">{usageError}</p>
            ) : null}

            {usageLoading && !usageData ? (
                <>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                </>
            ) : usageData ? (
                <>
                    {usageData.five_hour && (
                        <UsageRow
                            label={t('usageSection.session5hr')}
                            utilization={usageData.five_hour.utilization}
                            resetsAt={usageData.five_hour.resets_at}
                        />
                    )}
                    {usageData.seven_day && (
                        <UsageRow
                            label={t('usageSection.weekly7day')}
                            utilization={usageData.seven_day.utilization}
                            resetsAt={usageData.seven_day.resets_at}
                        />
                    )}
                    {usageData.seven_day_sonnet && (
                        <UsageRow
                            label={t('usageSection.weeklySonnet')}
                            utilization={usageData.seven_day_sonnet.utilization}
                            resetsAt={usageData.seven_day_sonnet.resets_at}
                        />
                    )}
                    {usageData.seven_day_opus && (
                        <UsageRow
                            label={t('usageSection.weeklyOpus')}
                            utilization={usageData.seven_day_opus.utilization}
                            resetsAt={usageData.seven_day_opus.resets_at}
                        />
                    )}
                </>
            ) : null}
        </div>
    )
}