import { useEffect, useCallback } from 'react';
import { useDocumentTitle } from '../hooks';
import { ChatInput } from './ChatInput';
import { SessionHeader } from './SessionHeader';
import { ChatMessageArea } from './ChatMessageArea';
import { useSessionContext } from '../contexts/SessionContext';
import { useChatStreamContext } from '../contexts/ChatStreamContext';

export function ChatPanel() {
  // Use ChatStreamContext for unified state management
  const {
    messages,
    isStreaming,
    isStopped,
    input,
    setInput,
    handleSubmit,
    retry,
    stop,
    continue: continueGeneration,
    streamingMessageId,
    tools,
  } = useChatStreamContext();

  const {
    currentSessionId,
    sessions,
    sessionState,
    workingDirectory,
    setWorkingDirectory,
    openNewTab,
    openSettings,
    switchSession,
    saveMessages,
  } = useSessionContext();

  const {
    pendingPermissions,
    approveToolUse,
    denyToolUse,
  } = tools;

  // Auto-save messages when they change (debounced in useSession)
  const lastMessage = messages[messages.length - 1];
  const lastMessageContent = lastMessage?.content;
  const lastMessageId = lastMessage?.id;

  useEffect(() => {
    if (currentSessionId && messages.length > 0 && !isStreaming) {
      saveMessages(messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId, messages.length, lastMessageId, lastMessageContent, isStreaming]);

  const handleOpenNewTab = useCallback(() => {
    openNewTab();
  }, [openNewTab]);

  const handleSelectProject = useCallback((path: string) => {
    setWorkingDirectory(path);
  }, [setWorkingDirectory]);

  // Handle submit - session creation is handled by ChatStreamContext.sendMessage
  const handleSubmitWithSession = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    handleSubmit(e);
  }, [handleSubmit]);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  // Session title: "Past Conversations" when in temporary state
  const sessionTitle = currentSession?.title || 'Past Conversations';

  // Update document title based on current session
  useDocumentTitle(currentSession?.title || null);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header - Minimal */}
      <div className="flex-shrink-0 border-b border-zinc-800">
        <SessionHeader
          sessions={sessions}
          currentSessionId={currentSessionId}
          sessionTitle={sessionTitle}
          onSelectSession={switchSession}
          onOpenNewTab={handleOpenNewTab}
          onOpenSettings={openSettings}
        />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto pb-16">
        <ChatMessageArea
          messages={messages}
          streamingMessageId={streamingMessageId}
          workingDirectory={workingDirectory}
          onSelectProject={handleSelectProject}
          onRetry={retry}
          approveToolUse={approveToolUse}
          denyToolUse={denyToolUse}
        />
      </div>

      {/* Pending Permissions Banner */}
      {pendingPermissions.length > 0 && (
        <div className="flex-shrink-0 bg-amber-900/20 border-t border-amber-700/50 px-6 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-400" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 11a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm1-3H7V4h2v5z" />
            </svg>
            <span className="text-sm text-amber-400 font-medium">
              {pendingPermissions.length} tool{pendingPermissions.length > 1 ? 's' : ''} awaiting approval
            </span>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0">
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmitWithSession}
          isStreaming={isStreaming}
          isStopped={isStopped}
          onStop={stop}
          onContinue={continueGeneration}
          disabled={sessionState === 'error' || !workingDirectory}
          sessionState={sessionState}
          sessionId={currentSessionId}
        />
      </div>
    </div>
  );
}
