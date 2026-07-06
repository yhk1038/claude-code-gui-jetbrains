import { useTranslation } from '@/i18n';
import type { TFunction } from 'i18next';

interface UsageMeterProps {
  label: string;
  utilization: number;
  resetsAt: string | null;
}

function formatTimeUntil(isoString: string, t: TFunction): string {
  const target = new Date(isoString);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return t('usage.meter.resetsSoon');

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const remainingMinutes = diffMinutes % 60;

  if (diffDays > 0) {
    // For weekly limits, show day-of-week and time format
    const days = [
      t('usage.meter.days.sun'),
      t('usage.meter.days.mon'),
      t('usage.meter.days.tue'),
      t('usage.meter.days.wed'),
      t('usage.meter.days.thu'),
      t('usage.meter.days.fri'),
      t('usage.meter.days.sat'),
    ];
    const dayName = days[target.getDay()];
    const hours = target.getHours();
    const minutes = target.getMinutes();
    const period = hours >= 12 ? t('usage.meter.pm') : t('usage.meter.am');
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const displayMinutes = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : ':00';
    return t('usage.meter.resetsOnDay', { day: dayName, period, time: `${displayHours}${displayMinutes}` });
  }

  if (diffHours > 0) {
    return t('usage.meter.resetsInHours', { hours: diffHours, minutes: remainingMinutes });
  }

  return t('usage.meter.resetsInMinutes', { minutes: remainingMinutes });
}

function formatExactTime(isoString: string): string {
  const target = new Date(isoString);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatted = target.toLocaleString('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const tzAbbr =
    target.toLocaleTimeString('en-US', { timeZone, timeZoneName: 'short' }).split(' ').pop() ?? timeZone;
  return `${formatted} (${tzAbbr})`;
}

function getBarColorClass(utilization: number): string {
  if (utilization >= 80) return 'bg-state-error-fg';
  if (utilization >= 50) return 'bg-state-warning-fg';
  return 'bg-accent-primary';
}

export function UsageMeter({ label, utilization, resetsAt }: UsageMeterProps) {
  const { t } = useTranslation('settings');
  const clamped = Math.min(100, Math.max(0, utilization));

  return (
    <div className="py-4 border-b border-border-default last:border-b-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-text-primary">{label}</span>
        <span className="text-sm text-text-secondary">{Math.round(clamped)}%</span>
      </div>

      <div className="w-full h-1 bg-surface-overlay rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getBarColorClass(clamped)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>

      {resetsAt && (
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-xs text-text-tertiary">{formatTimeUntil(resetsAt, t)}</p>
          <p className="text-xs text-text-disabled">{formatExactTime(resetsAt)}</p>
        </div>
      )}
    </div>
  );
}
