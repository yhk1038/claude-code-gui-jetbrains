import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChatInput } from './ChatInput';
import { SessionHeader } from './SessionHeader';
import { ChatMessageArea } from './ChatMessageArea';
import { PermissionBanner } from './PermissionBanner';
import { AskUserQuestionInputPanel } from './AskUserQuestionInputPanel';
import { AcceptPlanPanel } from './AcceptPlanPanel';
import { BannerArea } from './BannerArea';
import { UpdateBanner } from './UpdateBanner';
import { ConnectionLostBanner } from './ConnectionLostBanner';
import { useChatInputFocus } from '../../contexts/ChatInputFocusContext';
import { useChatStreamContext } from '../../contexts/ChatStreamContext';
import { usePendingAskUserQuestion } from '../../hooks/usePendingAskUserQuestion';
import { usePendingPermissions } from '../../hooks/usePendingPermissions';
import { usePendingPlanApproval } from '../../hooks/usePendingPlanApproval';

export function ChatPage() {
  const { textareaRef, focus: focusInput } = useChatInputFocus();
  const { messages, isStreaming } = useChatStreamContext();
  const { pending: pendingUserAnswer, dismiss } = usePendingAskUserQuestion(messages, isStreaming);
  const { pending: pendingPermission, approve: approvePermission, approveForSession, deny: denyPermission } = usePendingPermissions();
  const { pending: pendingPlan } = usePendingPlanApproval();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const [bottomPadding, setBottomPadding] = useState(144); // pb-36 = 144px

  useEffect(() => {
    const el = bottomPanelRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setBottomPadding(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

      <BannerArea>
        <UpdateBanner />
        <ConnectionLostBanner />
      </BannerArea>

      {/* Messages Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto w-full h-screen pt-10 bg-neutral-900 z-0" style={{ paddingBottom: bottomPadding }}>
        <ChatMessageArea isStreaming={isStreaming && !pendingUserAnswer && !pendingPlan && !pendingPermission} scrollContainerRef={scrollContainerRef} />
      </div>

      {/* Input Area */}
      <div ref={bottomPanelRef} className="fixed w-full bottom-0 z-10">
        {pendingUserAnswer ? (
          <AskUserQuestionInputPanel
            toolUse={pendingUserAnswer.toolUse}
            controlRequestId={pendingUserAnswer.controlRequestId}
            onDismiss={() => dismiss(pendingUserAnswer.toolUse.id)}
          />
        ) : pendingPlan ? (
          <AcceptPlanPanel />
        ) : pendingPermission ? (
          <PermissionBanner
            permission={pendingPermission}
            onApprove={() => approvePermission(pendingPermission.controlRequestId)}
            onApproveForSession={() => approveForSession(pendingPermission.controlRequestId)}
            onDeny={(reason) => denyPermission(pendingPermission.controlRequestId, reason)}
          />
        ) : (
          <ChatInput />
        )}
      </div>

    </div>
  );
}
