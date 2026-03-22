import { GroupedSessions, GROUP_ORDER, GROUP_LABELS } from './utils';
import { SessionItem } from './SessionItem';

interface Props {
  groupedSessions: GroupedSessions;
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function SessionList(props: Props) {
  const { groupedSessions, currentSessionId, onSelectSession, onDeleteSession } = props;

  return (
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
              <SessionItem
                key={session.id}
                session={session}
                isSelected={session.id === currentSessionId}
                onSelect={() => onSelectSession(session.id)}
                onDelete={() => onDeleteSession(session.id)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
