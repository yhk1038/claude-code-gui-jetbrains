import React, { useCallback, useRef } from 'react';
import { ChatInput } from './ChatInput';
import { SessionHeader } from './SessionHeader';
import { ChatMessageArea } from './ChatMessageArea';
import { PermissionBanner } from './PermissionBanner';
import { AskUserQuestionInputPanel } from './AskUserQuestionInputPanel';
import { UpdateBanner } from './UpdateBanner';
import { useChatInputFocus } from '../contexts/ChatInputFocusContext';
import { useChatStreamContext } from '../contexts/ChatStreamContext';
import { usePendingAskUserQuestion } from '../hooks/usePendingAskUserQuestion';
import { usePendingPermissions } from '../hooks/usePendingPermissions';

export function ChatPanel() {
  const { textareaRef, focus: focusInput } = useChatInputFocus();
  const { messages, isStreaming } = useChatStreamContext();
  const { pending: pendingUserAnswer, dismiss } = usePendingAskUserQuestion(messages, isStreaming);
  const { pending: pendingPermission, approve: approvePermission, deny: denyPermission } = usePendingPermissions();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 빈 영역 클릭 시 textarea로 포커스 이동
  // mousedown 시점에 확인해야 포커스 이동 전 activeElement를 비교할 수 있음
  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [role="button"], [contenteditable]')) {
      return;
    }
    if (document.activeElement === textareaRef.current) {
      // 이미 포커스 상태 → 브라우저가 포커스를 빼앗지 못하게 방지
      // e.preventDefault();
      return;
    }
    e.preventDefault();
    focusInput();
  }, [textareaRef, focusInput]);

  return (
    <div className="w-full h-screen bg-neutral-900 text-zinc-100" onMouseDown={handleContainerMouseDown}>
      {/* Header - Minimal */}
      <div className="fixed w-full top-0 bg-blend-darken bg-neutral-900 z-10">
        <SessionHeader />
      </div>
      <UpdateBanner />

      {/* Messages Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto w-full h-screen pt-10 pb-36 bg-neutral-900 z-0">
        <ChatMessageArea isStreaming={isStreaming && !pendingUserAnswer && !pendingPermission} scrollContainerRef={scrollContainerRef} />
      </div>

      {/* Input Area */}
      <div className={`${pendingUserAnswer ? 'relative' : 'fixed'} w-full bottom-0 z-10 ${pendingUserAnswer ? '-mt-36' : ''}`}>
        {pendingUserAnswer ? (
          <AskUserQuestionInputPanel
            toolUse={pendingUserAnswer.toolUse}
            controlRequestId={pendingUserAnswer.controlRequestId}
            onDismiss={() => dismiss(pendingUserAnswer.toolUse.id)}
          />
        ) : pendingPermission ? (
          <div className="max-w-[44rem] mx-auto px-4 pb-[14px] pt-2">
            <PermissionBanner
              request={{
                toolUse: {
                  id: pendingPermission.toolUseId,
                  name: pendingPermission.toolName,
                  input: pendingPermission.input,
                  status: 'pending' as any,
                },
                riskLevel: pendingPermission.riskLevel,
                description: pendingPermission.description,
              }}
              onApprove={() => approvePermission(pendingPermission.controlRequestId)}
              onDeny={() => denyPermission(pendingPermission.controlRequestId)}
              onExpand={() => {}}
            />
          </div>
        ) : (
          <ChatInput />
        )}
      </div>
    </div>
  );
}
