import { SessionMetaDto } from '@/dto';

/**
 * 상대 시간 표시 (Cursor 방식)
 * - 1분 미만: "now"
 * - 1분~59분: "5m"
 * - 1시간~23시간: "3h"
 * - 1일~29일: "7d"
 * - 30일~364일: "2mo"
 * - 1년 이상: "1y"
 */
export function getRelativeTime(date: Date): string {
  const elapsed = Date.now() - date.getTime();
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years}y`;
  if (months > 0) return `${months}mo`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return 'now';
}

export enum SessionGroup {
  Today = 'today',
  Yesterday = 'yesterday',
  PastWeek = 'pastWeek',
  PastMonth = 'pastMonth',
  PastYear = 'pastYear',
}

export type GroupedSessions = Record<SessionGroup, SessionMetaDto[]>;

export const GROUP_LABELS: Record<SessionGroup, string> = {
  [SessionGroup.Today]: 'Today',
  [SessionGroup.Yesterday]: 'Yesterday',
  [SessionGroup.PastWeek]: 'Past week',
  [SessionGroup.PastMonth]: 'Past month',
  [SessionGroup.PastYear]: 'Past year',
};

export const GROUP_ORDER: SessionGroup[] = [
  SessionGroup.Today,
  SessionGroup.Yesterday,
  SessionGroup.PastWeek,
  SessionGroup.PastMonth,
  SessionGroup.PastYear,
];

/**
 * 세션의 updatedAt 날짜를 기준으로 그룹을 결정
 * - Today/Yesterday: 날짜 기준 (00:00 시작점)
 * - Past week/Past month/Past year: 경과 시간 기준 (현재 시간으로부터)
 * @param date - 세션의 updatedAt 날짜
 * @param now - 현재 시간 (테스트 시 시간 주입용, 기본값: new Date())
 */
export function getSessionGroup(date: Date, now: Date = new Date()): SessionGroup {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);

  // Today/Yesterday: 날짜 기준 (Cursor 방식)
  if (date >= todayStart) return SessionGroup.Today;
  if (date >= yesterdayStart) return SessionGroup.Yesterday;

  // Past week/Past month/Past year: 경과 시간 기준 (Cursor 방식)
  const elapsed = now.getTime() - date.getTime();
  const WEEK_MS = 7 * DAY_MS;
  const MONTH_MS = 30 * DAY_MS;

  if (elapsed <= WEEK_MS) return SessionGroup.PastWeek;
  if (elapsed <= MONTH_MS) return SessionGroup.PastMonth;
  return SessionGroup.PastYear;
}

/**
 * 세션 목록을 날짜별 그룹으로 분류
 * @param sessions - 분류할 세션 목록
 * @param now - 현재 시간 (테스트 시 시간 주입용, 기본값: new Date())
 * @remarks session.updatedAt이 undefined일 경우 'pastYear' 그룹으로 분류
 */
export function groupSessionsByDate(sessions: SessionMetaDto[], now: Date = new Date()): GroupedSessions {
  const groups: GroupedSessions = {
    [SessionGroup.Today]: [],
    [SessionGroup.Yesterday]: [],
    [SessionGroup.PastWeek]: [],
    [SessionGroup.PastMonth]: [],
    [SessionGroup.PastYear]: [],
  };

  for (const session of sessions) {
    // updatedAt이 런타임에 undefined일 수 있음 (DTO 타입은 non-optional이지만 방어적 처리)
    const group = session.updatedAt ? getSessionGroup(session.updatedAt, now) : SessionGroup.PastYear;
    groups[group].push(session);
  }

  return groups;
}
