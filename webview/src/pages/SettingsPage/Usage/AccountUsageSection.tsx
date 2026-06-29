import type { AccountUsage } from '@/shared';
import { formatPlan } from '@/utils/accountFormat';
import { UsageMeter } from './UsageMeter';

interface AccountUsageSectionProps {
  account: AccountUsage;
}

export function AccountUsageSection({ account }: AccountUsageSectionProps) {
  // If the error is ccb_missing, we do not render any error block here.
  // The global notice in parent will display it.
  const hasDisplayError = account.error && account.errorKind !== 'ccb_missing';
  const plan = formatPlan(account.subscriptionType);

  return (
    <div className="mb-8 last:mb-0">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-text-primary tracking-wider">
          {account.emailAddress.toUpperCase()}
        </h3>
        {account.active && (
          <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-500 rounded border border-emerald-500/20">
            Active
          </span>
        )}

        {plan && (
          <div className="ml-auto">
            <div className="text-[0.7692rem] text-text-tertiary border border-border-default rounded px-1.5 py-0.5 shrink-0 cursor-default">
              {plan}
            </div>
          </div>
        )}
      </div>

      {hasDisplayError && (
        <div className="mb-4 p-3 bg-state-error-bg border border-state-error-border rounded-lg text-sm text-state-error-fg">
          Usage unavailable: {account.error}
        </div>
      )}

      {account.usage && (
        <div className="bg-surface-raised rounded-lg border border-border-default px-4">
          {account.usage.five_hour && (
            <UsageMeter
              label="Current Session (5h)"
              utilization={account.usage.five_hour.utilization}
              resetsAt={account.usage.five_hour.resets_at}
            />
          )}

          {(account.usage.seven_day || account.usage.seven_day_sonnet || account.usage.seven_day_opus) && (
            <div className="pt-8">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Weekly Limits
              </h4>
              {account.usage.seven_day && (
                <UsageMeter
                  label="All Models"
                  utilization={account.usage.seven_day.utilization}
                  resetsAt={account.usage.seven_day.resets_at}
                />
              )}
              {account.usage.seven_day_sonnet && (
                <UsageMeter
                  label="Sonnet only"
                  utilization={account.usage.seven_day_sonnet.utilization}
                  resetsAt={account.usage.seven_day_sonnet.resets_at}
                />
              )}
              {account.usage.seven_day_opus && (
                <UsageMeter
                  label="Opus only"
                  utilization={account.usage.seven_day_opus.utilization}
                  resetsAt={account.usage.seven_day_opus.resets_at}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
