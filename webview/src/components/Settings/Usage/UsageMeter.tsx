interface UsageMeterProps {
  label: string;
  utilization: number;
  resetsAt: string | null;
}

function formatTimeUntil(isoString: string): string {
  const target = new Date(isoString);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return '곧 재설정';

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const remainingMinutes = diffMinutes % 60;

  if (diffDays > 0) {
    // For weekly limits, show day-of-week and time format
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = days[target.getDay()];
    const hours = target.getHours();
    const minutes = target.getMinutes();
    const period = hours >= 12 ? '오후' : '오전';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const displayMinutes = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : ':00';
    return `(${dayName}) ${period} ${displayHours}${displayMinutes}에 재설정`;
  }

  if (diffHours > 0) {
    return `${diffHours}시간 ${remainingMinutes}분 후 재설정`;
  }

  return `${remainingMinutes}분 후 재설정`;
}

function formatExactTime(isoString: string): string {
  const target = new Date(isoString);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatted = target.toLocaleString('ko-KR', {
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
  if (utilization >= 80) return 'bg-red-500';
  if (utilization >= 50) return 'bg-yellow-500';
  return 'bg-blue-500';
}

export function UsageMeter({ label, utilization, resetsAt }: UsageMeterProps) {
  const clamped = Math.min(100, Math.max(0, utilization));

  return (
    <div className="py-3 border-b border-zinc-800 last:border-b-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-zinc-200">{label}</span>
        <span className="text-sm text-zinc-400">{Math.round(clamped)}%</span>
      </div>

      <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getBarColorClass(clamped)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>

      {resetsAt && (
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-xs text-zinc-500">{formatTimeUntil(resetsAt)}</p>
          <p className="text-xs text-zinc-600">{formatExactTime(resetsAt)}</p>
        </div>
      )}
    </div>
  );
}
