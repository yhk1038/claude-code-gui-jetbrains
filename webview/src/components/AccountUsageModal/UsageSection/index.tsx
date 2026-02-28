import { ArrowPathIcon } from '@heroicons/react/24/outline';
import {useUsageData} from "@/components/Settings/Usage/useUsageData";
import { SectionLabel } from '../SectionLabel';
import { SkeletonRow } from '../SkeletonRow';
import { UsageRow } from '../UsageRow';
import { formatRelativeTime } from '../formatters';

interface Props {
    //
}

export const UsageSection = (props: Props) => {
    const {} = props;
    const { data: usageData, isLoading: usageLoading, error: usageError, lastUpdated, refresh } = useUsageData();

    return (
        <div>
            <SectionLabel className="flex items-center justify-between">
                <div>Usage</div>

                <div className="flex items-center gap-2 text-[11px] text-zinc-500 normal-case font-[400] hover:text-white transition-all">
                    {lastUpdated && <span>Updated {formatRelativeTime(lastUpdated)}</span>}
                    <button
                        onClick={refresh}
                        disabled={usageLoading}
                        className="p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-40"
                        title="Refresh"
                    >
                        <ArrowPathIcon className={`w-3 h-3 ${usageLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </SectionLabel>

            {usageError && (
                <p className="text-xs text-red-400 mb-2">{usageError}</p>
            )}

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
                            label="Session (5hr)"
                            utilization={usageData.five_hour.utilization}
                            resetsAt={usageData.five_hour.resets_at}
                        />
                    )}
                    {usageData.seven_day && (
                        <UsageRow
                            label="Weekly (7 day)"
                            utilization={usageData.seven_day.utilization}
                            resetsAt={usageData.seven_day.resets_at}
                        />
                    )}
                    {usageData.seven_day_sonnet && (
                        <UsageRow
                            label="Weekly Sonnet"
                            utilization={usageData.seven_day_sonnet.utilization}
                            resetsAt={usageData.seven_day_sonnet.resets_at}
                        />
                    )}
                    {usageData.seven_day_opus && (
                        <UsageRow
                            label="Weekly Opus"
                            utilization={usageData.seven_day_opus.utilization}
                            resetsAt={usageData.seven_day_opus.resets_at}
                        />
                    )}
                </>
            ) : null}
        </div>
    )
}