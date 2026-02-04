import { SessionMetaDto } from '@/dto';
import { useState, useRef, useEffect, useMemo } from 'react';

interface SessionHeaderProps {
  sessions: SessionMetaDto[];
  currentSessionId: string | null;
  sessionTitle: string;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
}

/**
 * 상대 시간 표시 (Cursor 방식)
 * - 1분 미만: "now"
 * - 1분~59분: "5m"
 * - 1시간~23시간: "3h"
 * - 1일~29일: "7d"
 * - 30일~364일: "2mo"
 * - 1년 이상: "1y"
 */
function getRelativeTime(date: Date): string {
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

enum SessionGroup {
  Today = 'today',
  Yesterday = 'yesterday',
  PastWeek = 'pastWeek',
  PastMonth = 'pastMonth',
  PastYear = 'pastYear',
}

type GroupedSessions = Record<SessionGroup, SessionMetaDto[]>;

const GROUP_LABELS: Record<SessionGroup, string> = {
  [SessionGroup.Today]: 'Today',
  [SessionGroup.Yesterday]: 'Yesterday',
  [SessionGroup.PastWeek]: 'Past week',
  [SessionGroup.PastMonth]: 'Past month',
  [SessionGroup.PastYear]: 'Past year',
};

const GROUP_ORDER: SessionGroup[] = [
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
function getSessionGroup(date: Date, now: Date = new Date()): SessionGroup {
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
function groupSessionsByDate(sessions: SessionMetaDto[], now: Date = new Date()): GroupedSessions {
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

export function SessionHeader({
  sessions,
  currentSessionId,
  sessionTitle,
  onSelectSession,
  onCreateSession,
}: SessionHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Filter sessions using regex
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    try {
      const regex = new RegExp(searchQuery, 'i');
      return sessions.filter(s => regex.test(s.title));
    } catch {
      // Invalid regex, fall back to includes
      return sessions.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  }, [sessions, searchQuery]);

  const groupedSessions = useMemo(() => {
    return groupSessionsByDate(filteredSessions);
  }, [filteredSessions]);

  const handleSelectSession = (sessionId: string) => {
    onSelectSession(sessionId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleCreateSession = () => {
    onCreateSession();
    setIsOpen(false);
  };

  return (
    <div className="flex justify-between items-center px-2 py-1">
      {/* Left: Session dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 px-2 py-0.5 text-[13px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50 rounded transition-colors"
        >
          <span className="max-w-[300px] truncate">{sessionTitle || 'New Chat'}</span>
          <svg
            className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M4.427 6.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 6H4.604a.25.25 0 0 0-.177.427z" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute left-0 top-full mt-1 w-[23rem] bg-zinc-900 border border-zinc-700 rounded-md shadow-xl overflow-hidden z-50">
            {/* Search input */}
            <div className="p-1.5">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-zinc-800 text-zinc-300 px-2.5 py-1.5 rounded outline-none placeholder:text-zinc-500"
                placeholder="Search sessions..."
                autoFocus
              />
            </div>

            {/* Session list */}
            {filteredSessions.length > 0 && (
              <div className="max-h-80 overflow-y-auto p-1.5 pt-0 flex flex-col gap-0.5">
                {GROUP_ORDER.map((groupKey) => {
                  const sessionsInGroup = groupedSessions[groupKey];
                  if (sessionsInGroup.length === 0) return null;

                  return (
                    <div key={groupKey}>
                      <div className="px-2 py-1.5 text-[11px] text-zinc-500">
                        {GROUP_LABELS[groupKey]}
                      </div>
                      {sessionsInGroup.map((session) => (
                        <button
                          key={session.id}
                          onClick={() => handleSelectSession(session.id)}
                          className={`w-full px-2 py-1.5 text-left text-xs rounded transition-colors flex justify-between items-center gap-2 ${
                            session.id === currentSessionId
                              ? 'text-zinc-100 bg-zinc-700/70'
                              : 'text-zinc-400 hover:bg-zinc-700/40'
                          }`}
                          title={session.title}
                        >
                          <span className="truncate flex-1">{session.title}</span>
                          {session.updatedAt && (
                            <span className="text-[11px] text-zinc-500 flex-shrink-0">
                              {getRelativeTime(session.updatedAt)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {filteredSessions.length === 0 && (
              <div className="px-2.5 py-3 text-xs text-zinc-500 text-center">
                {searchQuery.trim() ? 'No matching sessions' : 'No sessions yet'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: New session button (disabled when in initialized session state) */}
      <button
        onClick={handleCreateSession}
        disabled={!currentSessionId}
        className={`p-1 rounded transition-colors ${
          currentSessionId
            ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            : 'text-zinc-600 cursor-not-allowed'
        }`}
        title={currentSessionId ? 'New Chat' : 'Already in new session'}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
