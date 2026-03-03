import { SessionMeta, LoadedMessageDto, getTextContent } from '../types';
import { SessionItem } from './SessionItem';
import { LoadedMessageType } from '../dto/common';

interface SessionListProps {
  sessions: SessionMeta[];
  currentSessionId: string | null;
  messages: LoadedMessageDto[];
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function SessionList({
  sessions,
  currentSessionId,
  messages,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
}: SessionListProps) {
  // Get last user message from current messages for preview
  const getLastMessage = (sessionId: string): string | undefined => {
    if (sessionId !== currentSessionId) return undefined;
    const userMessages = messages.filter(m => m.type === LoadedMessageType.User);
    if (userMessages.length === 0) return undefined;
    return getTextContent(userMessages[userMessages.length - 1]);
  };

  return (
    <div className="w-64 h-full bg-zinc-950 border-r border-zinc-800 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800">
        <button
          onClick={onCreateSession}
          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-150 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/50"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
          </svg>
          New Session
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {sessions.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-zinc-800/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm text-zinc-500">No sessions yet2</p>
            <p className="text-xs text-zinc-600 mt-1">Create a new session to get started</p>
          </div>
        ) : (
          <div className="py-2">
            {sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === currentSessionId}
                lastMessage={getLastMessage(session.id)}
                onSelect={onSelectSession}
                onRename={onRenameSession}
                onDelete={onDeleteSession}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-zinc-800">
        <div className="flex items-center justify-between text-xs text-zinc-600">
          <span>{sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}</span>
          {currentSessionId && (
            <span className="font-mono">
              {currentSessionId.slice(0, 8)}...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
