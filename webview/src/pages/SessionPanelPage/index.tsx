import { useState } from 'react';
import { useSessionContext } from '@/contexts/SessionContext';
import { useSessionList } from '@/components/SessionList/useSessionList';
import { SessionList } from '@/components/SessionList';
import { SearchInput } from '@/components/SessionList/SearchInput';
import { getAdapter } from '@/adapters';
import { ScopeTabs, SessionScope } from './ScopeTabs';

/**
 * 좌측 세션 패널 전용 뷰 (/session-panel).
 *
 * JetBrains 좌측 툴 윈도우의 JCEF WebView가 이 라우트로 진입한다.
 * 세션 선택은 "항상 새 에디터 탭"으로 열린다(adapter.openSession 경유).
 */
export function SessionPanelPage() {
  const { openNewTab } = useSessionContext();
  const {
    currentSessionId,
    searchQuery,
    setSearchQuery,
    filteredSessions,
    groupedSessions,
    handleDeleteSession,
    renameSession,
    confirmDialog,
  } = useSessionList();
  const [scope, setScope] = useState<SessionScope>(SessionScope.Local);

  const handleSelectSession = (sessionId: string) => {
    getAdapter().openSession(sessionId).catch((error) => {
      console.error('[SessionPanelPage] Failed to open session:', error);
    });
  };

  return (
    <div className="flex flex-col h-screen bg-surface-base text-text-primary">
      <div className="flex-shrink-0 px-1.5 pt-2">
        <button
          onClick={openNewTab}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded transition-colors"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New session
        </button>
      </div>

      <div className="flex-shrink-0 px-1.5 pt-1">
        <ScopeTabs scope={scope} onScopeChange={setScope} />
      </div>

      <div className="flex-shrink-0">
        <SearchInput value={searchQuery} onChange={setSearchQuery} />
      </div>

      {scope === SessionScope.Local ? (
        filteredSessions.length > 0 ? (
          <SessionList
            className="flex-1 min-h-0"
            groupedSessions={groupedSessions}
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={renameSession}
          />
        ) : (
          <div className="flex-1 px-2.5 py-3 text-xs text-text-tertiary text-center">
            {searchQuery.trim() ? 'No matching sessions' : 'No sessions yet'}
          </div>
        )
      ) : (
        <div className="flex-1 px-2.5 py-3 text-xs text-text-tertiary text-center">
          No web sessions
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
