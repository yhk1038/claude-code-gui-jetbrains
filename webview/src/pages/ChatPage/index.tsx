import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { ChatInput } from './ChatInput';
import { SessionHeader } from './SessionHeader';
import { ChatMessageArea } from './ChatMessageArea';
import { PermissionBanner } from './PermissionBanner';
import { AskUserQuestionInputPanel } from './AskUserQuestionInputPanel';
import { AcceptPlanPanel } from './AcceptPlanPanel';
import { BannerArea } from './BannerArea';
import { UpdateBanner } from './UpdateBanner';
import { ConnectionLostBanner } from './ConnectionLostBanner';
import { BrowserPermissionBanner } from './BrowserPermissionBanner';
import { BackgroundTasksPanel } from './BackgroundTasksPanel';
import { McpModal } from '@/components/McpModal';
import { OPEN_MCP_MODAL_EVENT } from '@/commandPalette/sections/customize/items';
import { useMcpServers, MCP_SERVERS_QUERY_KEY } from '@/hooks/useMcpServers';
import { useQueryClient } from '@tanstack/react-query';
import { useChatInputFocus } from '../../contexts/ChatInputFocusContext';
import { useChatStreamContext } from '../../contexts/ChatStreamContext';
import { useSessionContext } from '../../contexts/SessionContext';
import { useAwaitingNotifications, useLoginGate } from '../../hooks';
import { usePendingAskUserQuestion } from '../../hooks/usePendingAskUserQuestion';
import { usePendingPermissions } from '../../hooks/usePendingPermissions';
import { usePendingPlanApproval } from '../../hooks/usePendingPlanApproval';
import { useNotificationSound } from '@/notifications';
import {isMobile} from "@/config/environment.ts";
import { useSettings } from '@/contexts/SettingsContext';
import { SettingKey } from '@/types/settings';
import { clampAutoScrollThreshold, nextAutoFollow, shouldShowScrollToBottom, AUTO_SCROLL_THRESHOLD_DEFAULT, AUTO_SCROLL_BOTTOM_EPS } from '@/utils/autoScroll';

export function ChatPage() {
  // Redirect logged-out users to the login screen before they hit a failing chat.
  useLoginGate();

  // pre-fetch: ChatPage 마운트 시 query를 활성화해 모달이 즉시 표시되도록
  useMcpServers();
  const queryClient = useQueryClient();
  const [mcpModalOpen, setMcpModalOpen] = useState(false);

  useEffect(() => {
    const handler = () => {
      // 모달 오픈 시 캐시 invalidate → 최신 상태 보장
      void queryClient.invalidateQueries({ queryKey: MCP_SERVERS_QUERY_KEY });
      setMcpModalOpen(true);
    };
    window.addEventListener(OPEN_MCP_MODAL_EVENT, handler);
    return () => window.removeEventListener(OPEN_MCP_MODAL_EVENT, handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { textareaRef, focus: focusInput } = useChatInputFocus();
  const { currentSessionId, currentSession } = useSessionContext();
  const { messages, isStreaming } = useChatStreamContext();
  const { pending: pendingUserAnswer, dismiss } = usePendingAskUserQuestion(messages, isStreaming);
  const { pending: pendingPermission, approve: approvePermission, approveForSession, deny: denyPermission } = usePendingPermissions();
  const { pending: pendingPlan, approve: approvePlan, deny: denyPlan } = usePendingPlanApproval();
  const { selection: soundSelection } = useNotificationSound();
  const { settings } = useSettings();
  const autoScrollThreshold = clampAutoScrollThreshold(
    settings[SettingKey.AUTO_SCROLL_THRESHOLD] ?? AUTO_SCROLL_THRESHOLD_DEFAULT,
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Auto-follow tracks user *intent*, not viewport position. A large block
  // inserted at once grows scrollHeight while scrollTop stays put — the user
  // did not move, so following must continue (issue #100). Only a deliberate
  // upward scroll (negative scrollTop delta) releases it.
  const autoFollowRef = useRef(true);
  const prevScrollTopRef = useRef(0);
  const lastScrollHeightRef = useRef(0);
  // Button visibility is a separate, position-aware decision from auto-follow
  // (which tracks intent): the button hides whenever the view already shows the
  // bottom — auto-follow active, no messages, or within the resume threshold.
  const hasMessagesRef = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    hasMessagesRef.current = messages.length > 0;
  }, [messages.length]);

  // Drive auto-follow from a requestAnimationFrame loop. A single loop both
  // decides the next auto-follow state and performs the scroll, so the two can
  // never disagree. The scroll itself is animated by CSS `scroll-smooth` on the
  // container, so a large block inserted at once slides into view instead of
  // jumping. We only call scrollTo when scrollHeight actually changed: firing it
  // every frame at the same target restarts the smooth animation each frame and
  // can stall it. The programmatic scroll moves the view down (delta >= 0),
  // which never satisfies the upward-release test — so it cannot release itself
  // and needs no guard flag. rAF is reliable in JCEF (Chromium), unlike the
  // scroll events / IntersectionObserver that earlier polling worked around.
  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      const el = scrollContainerRef.current;
      if (el) {
        const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
        const delta = el.scrollTop - prevScrollTopRef.current;
        const next = nextAutoFollow(autoFollowRef.current, delta, dist, autoScrollThreshold);
        autoFollowRef.current = next;
        const show = shouldShowScrollToBottom(next, hasMessagesRef.current, dist, autoScrollThreshold);
        setShowScrollButton(prev => (prev === show ? prev : show));
        const grew = el.scrollHeight !== lastScrollHeightRef.current;
        if (next && grew && dist > AUTO_SCROLL_BOTTOM_EPS) {
          el.scrollTo({ top: el.scrollHeight });
        }
        lastScrollHeightRef.current = el.scrollHeight;
        prevScrollTopRef.current = el.scrollTop;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [autoScrollThreshold]);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    autoFollowRef.current = true;
    setShowScrollButton(false);
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  useAwaitingNotifications(currentSession?.title ?? null, soundSelection, {
    pendingPermission: pendingPermission !== null,
    pendingPlanApproval: pendingPlan !== null,
    pendingUserAnswer: pendingUserAnswer !== null,
  });

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
      const top = Number(cached);
      requestAnimationFrame(() => {
        el.scrollTop = top;
        // Sync the poll baseline so the next tick does not read the restore as a
        // huge upward scroll, and release auto-follow unless we restored near
        // the bottom — otherwise the first tick would yank the view back down
        // and defeat the restore.
        prevScrollTopRef.current = el.scrollTop;
        const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
        const atBottom = dist <= autoScrollThreshold;
        autoFollowRef.current = atBottom;
        // Button visibility is reconciled by the rAF loop on the next frame.
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
    <div className="flex flex-col w-full h-screen bg-surface-base text-text-primary fixed left-0 top-0" onMouseDown={handleContainerMouseDown}>
      {/* Header - Minimal */}
      <div className="fixed w-full top-0 bg-blend-darken bg-surface-base z-30">
        <SessionHeader />
      </div>

      <BannerArea>
        <UpdateBanner />
        <ConnectionLostBanner />
        <BrowserPermissionBanner />
      </BannerArea>

      {/* Messages Area */}
      <div ref={scrollContainerRef} className={`flex flex-col flex-1 overflow-y-auto scroll-smooth w-full h-screen pt-10 ${isMobile() ? 'pb-52' : ''} bg-surface-base z-0`}>
        <ChatMessageArea
          isStreaming={isStreaming && !pendingUserAnswer && !pendingPlan && !pendingPermission}
        />

        {/* Input Area */}
        <div className="sticky w-full left-0 bottom-0 z-10">
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

      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-[7.5rem] left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-surface-raised border border-border-default rounded-full shadow-md text-xs text-text-primary hover:bg-surface-hover transition-colors"
        >
          <ChevronDownIcon className="w-3.5 h-3.5" />
          Scroll to bottom
        </button>
      )}

      <BackgroundTasksPanel />
      {mcpModalOpen && <McpModal onClose={() => setMcpModalOpen(false)} />}
    </div>
  );
}
