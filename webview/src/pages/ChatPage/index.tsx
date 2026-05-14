import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { useSessionContext } from '../../contexts/SessionContext';
import { usePendingAskUserQuestion } from '../../hooks/usePendingAskUserQuestion';
import { usePendingPermissions } from '../../hooks/usePendingPermissions';
import { usePendingPlanApproval } from '../../hooks/usePendingPlanApproval';
import { isMobile } from '@/config/environment.ts';

/** Default scroll clearance until layout measure (was ~pt-10). */
const DEFAULT_HEADER_SCROLL_CLEARANCE_PX = 40;

/**
 * UserMessageRenderer wraps content in `pt-2` (`0.5rem` = 8px). Sticky is on the outer row, so
 * `top` subtracts this so the bordered MessageBox aligns with the SessionHeader bottom edge.
 */
const USER_PROMPT_ROW_PADDING_TOP_PX = 8;

/**
 * Extra offset to pull the sticky user row closer to the fixed header (JCEF / blended header / subpixel).
 * Only affects `--chat-session-header-offset`, not the spacer height.
 */
const STICKY_USER_PROMPT_EXTRA_UP_PX = 16;

export function ChatPage() {
  const { textareaRef, focus: focusInput } = useChatInputFocus();
  const { currentSessionId } = useSessionContext();
  const { messages, isStreaming } = useChatStreamContext();
  const { pending: pendingUserAnswer, dismiss } = usePendingAskUserQuestion(messages, isStreaming);
  const { pending: pendingPermission, approve: approvePermission, approveForSession, deny: denyPermission } = usePendingPermissions();
  const { pending: pendingPlan, approve: approvePlan, deny: denyPlan } = usePendingPlanApproval();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const sessionHeaderWrapRef = useRef<HTMLDivElement>(null);
  const bannerFlowRef = useRef<HTMLDivElement>(null);
  /** Vertical space under fixed SessionHeader reserved in the scroll stream (spacer height). */
  const [headerScrollClearancePx, setHeaderScrollClearancePx] = useState(DEFAULT_HEADER_SCROLL_CLEARANCE_PX);

  const stickyUserPromptTopPx = Math.max(
    0,
    headerScrollClearancePx - USER_PROMPT_ROW_PADDING_TOP_PX - STICKY_USER_PROMPT_EXTRA_UP_PX,
  );

  useLayoutEffect(() => {
    let raf = 0;

    const measure = () => {
      const headerEl = sessionHeaderWrapRef.current;
      const scrollEl = scrollContainerRef.current;
      if (!headerEl || !scrollEl) return;

      const headerRect = headerEl.getBoundingClientRect();
      const scrollRect = scrollEl.getBoundingClientRect();
      /*
       * Scroll clearance: SessionHeader bottom − scroll viewport top. Matches the region where
       * the fixed header covers the message list. Uses bottom − top (not height − inset) so non-zero
       * header `top` in embedded views still lines up.
       *
       * Use a flex spacer instead of `padding-top` on the scroller: padding + `position: sticky`
       * can leave an extra empty band in some engines (incl. JCEF).
       */
      const clearance = Math.max(0, Math.round(headerRect.bottom - scrollRect.top));
      setHeaderScrollClearancePx(clearance);
    };

    const scheduleMeasure = () => {
      measure();
      raf = requestAnimationFrame(measure);
    };

    scheduleMeasure();

    const observed = [
      sessionHeaderWrapRef.current,
      scrollContainerRef.current,
      bannerFlowRef.current,
    ].filter((n): n is HTMLDivElement => n != null);

    const ro = new ResizeObserver(scheduleMeasure);
    observed.forEach((target) => ro.observe(target));

    window.addEventListener('resize', scheduleMeasure);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, []);

  // Save scroll position to localStorage (debounced via scroll event)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !currentSessionId) return;

    let saveTimer: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        localStorage.setItem(`claude-gui:scroll:${currentSessionId}`, String(el.scrollTop));
      }, 300);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(saveTimer);
      el.removeEventListener('scroll', handleScroll);
    };
  }, [currentSessionId]);

  // Restore scroll position after messages load
  useEffect(() => {
    if (!currentSessionId || messages.length === 0) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    const key = `claude-gui:scroll:${currentSessionId}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      requestAnimationFrame(() => {
        el.scrollTop = Number(cached);
      });
      localStorage.removeItem(key);
    }
  }, [currentSessionId, messages.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="flex flex-col w-full h-screen bg-neutral-900 text-zinc-100 fixed left-0 top-0" onMouseDown={handleContainerMouseDown}>
      {/* Header - Minimal */}
      <div ref={sessionHeaderWrapRef} className="fixed w-full top-0 bg-blend-darken bg-neutral-900 z-10">
        <SessionHeader />
      </div>

      <div ref={bannerFlowRef} className="w-full shrink-0">
        <BannerArea>
          <UpdateBanner />
          <ConnectionLostBanner />
        </BannerArea>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollContainerRef}
        className={`flex flex-col flex-1 overflow-y-auto w-full h-screen ${isMobile() ? 'pb-52' : ''} bg-neutral-900 z-0`}
        style={{
          '--chat-session-header-offset': `${stickyUserPromptTopPx}px`,
        } as React.CSSProperties}
      >
        <div
          aria-hidden
          className="shrink-0 pointer-events-none"
          style={{ height: headerScrollClearancePx }}
        />
        <ChatMessageArea isStreaming={isStreaming && !pendingUserAnswer && !pendingPlan && !pendingPermission} scrollContainerRef={scrollContainerRef} />

        {/* Input Area */}
        <div ref={bottomPanelRef} className="sticky w-full left-0 bottom-0 z-10">
          {pendingUserAnswer ? (
            <AskUserQuestionInputPanel
              toolUse={pendingUserAnswer.toolUse}
              controlRequestId={pendingUserAnswer.controlRequestId}
              onDismiss={() => dismiss(pendingUserAnswer.toolUse.id)}
            />
          ) : pendingPlan ? (
            <AcceptPlanPanel
              pending={pendingPlan}
              onApprove={approvePlan}
              onDeny={denyPlan}
            />
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
    </div>
  );
}
