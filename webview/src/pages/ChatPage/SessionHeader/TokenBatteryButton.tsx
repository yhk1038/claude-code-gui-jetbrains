import { useUsageData } from '@/pages/SettingsPage/Usage/useUsageData';
import { formatTimeUntil } from '@/components/AccountUsageModal/formatters';

interface Props {
  className?: string;
}

function getBatteryColor(remaining: number): string {
  if (remaining > 50) return '#22c55e';
  if (remaining >= 20) return '#eab308';
  return '#ef4444';
}

export function TokenBatteryButton(props: Props) {
  const { className } = props;
  const { data, isLoading, error } = useUsageData();

  if (!data && !isLoading && error) {
    return null;
  }

  if (!data) return null;

  const remaining = 100 - (data.five_hour?.utilization ?? 0);
  const resetsAt = data.five_hour?.resets_at;
  const color = getBatteryColor(remaining);
  const isPulsing = remaining < 20;
  const fillWidth = Math.max(0, Math.min(100, remaining));

  const title = resetsAt ? formatTimeUntil(resetsAt) : undefined;

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('open-account-usage'));
  };

  return (
    <button
      onClick={handleClick}
      title={title}
      className={`flex items-center gap-1 px-1.5 py-1 rounded transition-colors text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 ${className ?? ''}`}
    >
      <span className={isLoading ? 'opacity-50' : undefined}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={isPulsing ? 'animate-pulse' : undefined}
        >
          {/* 배터리 몸체 외곽선 */}
          <rect
            x="1"
            y="4"
            width="12"
            height="8"
            rx="1.5"
            ry="1.5"
            stroke={color}
            strokeWidth="1.2"
            fill="none"
          />
          {/* 배터리 꼭지 */}
          <rect
            x="13"
            y="6.5"
            width="1.5"
            height="3"
            rx="0.5"
            ry="0.5"
            fill={color}
          />
          {/* 내부 채움 — 왼쪽부터 remaining% 비율로 */}
          <rect
            x="2.5"
            y="5.5"
            width={`${(9 * fillWidth) / 100}`}
            height="5"
            rx="0.5"
            ry="0.5"
            fill={color}
          />
        </svg>
      </span>
      <span className="text-xs" style={{ color }}>
        {Math.round(remaining)}%
      </span>
    </button>
  );
}
