import { useEffect, useRef, useCallback } from 'react';
import { useDocumentTitle } from '../hooks';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { ToolCard } from './ToolCard';
import { SessionHeader } from './SessionHeader';
import { useSessionContext } from '../contexts/SessionContext';
import { useChatContext } from '../contexts/ChatContext';

export function ChatPanel() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Use ChatContext instead of direct useChat() to share state with AppProviders
  const { chat, tools, stop, continue: continueGeneration } = useChatContext();
  const {
    messages,
    isStreaming,
    isStopped,
    input,
    setInput,
    handleSubmit,
    retry,
    clearMessages,
  } = chat;

  const {
    currentSessionId,
    sessions,
    sessionState,
    resetToNewSession,
    createSessionWithMessage,
    switchSession,
    saveMessages,
  } = useSessionContext();

  const {
    pendingPermissions,
    approveToolUse,
    denyToolUse,
  } = tools;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const isEmpty = messages.length === 0;

  const handleCreateSession = useCallback(() => {
    clearMessages();
    resetToNewSession();
  }, [clearMessages, resetToNewSession]);

  // Handle submit with automatic session creation on first message
  const handleSubmitWithSession = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();

    // Create session on first message if in temporary state
    if (!currentSessionId && input.trim()) {
      createSessionWithMessage(input.trim());
    }

    handleSubmit(e);
  }, [currentSessionId, input, createSessionWithMessage, handleSubmit]);

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
          onCreateSession={handleCreateSession}
        />
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto pb-16"
      >
        {isEmpty ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-zinc-500 text-sm">메시지를 입력하세요</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto text-xs">
            {messages.map((message) => (
              <div key={message.id}>
                <MessageBubble message={message} onRetry={retry} />

                {/* Show tool cards for this message */}
                {message.toolUses?.map((toolUse) => (
                  <div key={toolUse.id} className="px-6">
                    <ToolCard
                      toolUse={toolUse}
                      onApprove={approveToolUse}
                      onDeny={denyToolUse}
                    />
                  </div>
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
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
          disabled={sessionState === 'error'}
          sessionState={sessionState}
        />
      </div>
    </div>
  );
}
