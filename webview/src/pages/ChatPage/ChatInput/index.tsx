import { useCallback, useEffect, useRef, KeyboardEvent, useState } from 'react';
import { CommandPalettePanel } from '@/commandPalette/ui/CommandPalettePanel';
import { useCommandPalette } from '@/commandPalette/hooks/useCommandPalette';
import { PanelSectionId, PanelItemType, CommandItem } from '@/types/commandPalette';
import { INPUT_MODES, CLI_FLAG_TO_INPUT_MODE } from '../../../types/chatInput';
import { InputModeTag } from './InputModeTag';
import { ActionButtons } from './ActionButtons';
import { useChatInputFocus } from '../../../contexts/ChatInputFocusContext';
import { useInputHistory } from './hooks/useInputHistory';
import { useTextareaAutoResize } from './hooks/useTextareaAutoResize';
import { useSessionContext } from '@/contexts/SessionContext';
import { useChatStreamContext } from '@/contexts/ChatStreamContext';
import { getTextContent, SessionState } from '@/types';
import { LoadedMessageType } from '@/dto';
import { useAttachments } from './hooks/useAttachments';
import { AttachmentPreview } from './AttachmentPreview';
import { ContextWindowTag } from './ContextWindowTag';
import { DragOverlay } from './DragOverlay';
import { AttachMenu } from './AttachMenu';
import { ModelSwitchOverlay, SWITCH_MODEL_EVENT } from '@/pages/ChatPage/ModelSwitchOverlay';
import { EFFORT_CYCLE_EVENT } from '@/commandPalette/sections/model/EffortItem';
import { THINKING_TOGGLE_EVENT } from '@/commandPalette/sections/model/ThinkingItem';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';
import { useEffort } from '@/hooks/useEffort';
import { useMention } from './hooks/useMention';
import { MentionDropdown } from './MentionDropdown';
import { isMobile } from '@/config/environment';

export function ChatInput() {
  const { textareaRef } = useChatInputFocus();
  const { currentSessionId, sessionState, workingDirectory, inputMode: mode, cycleInputMode: cycleMode, syncInitialInputMode, modeResetTrigger } = useSessionContext();
  const {
    messages,
    input: value,
    setInput: onChange,
    handleSubmit: onSubmit,
    isStreaming,
    stop: onStop,
  } = useChatStreamContext();
  const inputHistory = useInputHistory();
  const [isFocused, setIsFocused] = useState(false);
  const lastInitSessionRef = useRef<string | undefined>(undefined);

  const {
    attachments,
    addImageAttachment,
    addFileAttachment,
    addFolderAttachment,
    removeAttachment,
    clearAttachments,
    error: attachmentError,
    isDragOver,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useAttachments();

  const { settings: claudeSettings, updateSetting: updateClaudeSetting } = useClaudeSettings();
  const { cycle: cycleEffort } = useEffort();
  const lastMetaArrowTime = useRef<number>(0);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showModelSwitch, setShowModelSwitch] = useState(false);

  // 커맨드 팔레트 "Attach file..." 항목 연동
  useEffect(() => {
    const handleAttachFromPalette = () => {
      setShowAttachMenu(true);
    };
    window.addEventListener('command-palette:attach-files', handleAttachFromPalette);
    return () => window.removeEventListener('command-palette:attach-files', handleAttachFromPalette);
  }, []);

  // 커맨드 팔레트 "Switch model..." 항목 연동
  useEffect(() => {
    const handler = () => setShowModelSwitch(true);
    window.addEventListener(SWITCH_MODEL_EVENT, handler);
    return () => window.removeEventListener(SWITCH_MODEL_EVENT, handler);
  }, []);

  // 커맨드 팔레트 "Effort" 항목 연동: 클릭 시 레벨 순환
  useEffect(() => {
    const handler = () => cycleEffort();
    window.addEventListener(EFFORT_CYCLE_EVENT, handler);
    return () => window.removeEventListener(EFFORT_CYCLE_EVENT, handler);
  }, [cycleEffort]);

  // 커맨드 팔레트 "Thinking" 항목 연동: 라벨 클릭 시 토글
  useEffect(() => {
    const handler = () => {
      const current = claudeSettings.alwaysThinkingEnabled ?? true;
      void updateClaudeSetting('alwaysThinkingEnabled', !current);
    };
    window.addEventListener(THINKING_TOGGLE_EVENT, handler);
    return () => window.removeEventListener(THINKING_TOGGLE_EVENT, handler);
  }, [claudeSettings.alwaysThinkingEnabled, updateClaudeSetting]);

  const disabled = sessionState === SessionState.Error || !workingDirectory;

  // Claude settings의 permissions.defaultMode에서 초기 모드 결정
  const defaultModeFlag = claudeSettings.permissions?.defaultMode;
  const initialInputMode = defaultModeFlag
    ? (CLI_FLAG_TO_INPUT_MODE[defaultModeFlag] ?? 'ask_before_edit')
    : 'ask_before_edit';
  useEffect(() => {
    syncInitialInputMode(initialInputMode);
  }, [initialInputMode, syncInitialInputMode, modeResetTrigger]);

  const modeConfig = INPUT_MODES[mode];

  const palette = useCommandPalette({ onChange, textareaRef });

  const mention = useMention({
    workingDirectory,
    addFileAttachment,
    addFolderAttachment,
    value,
    onChange,
  });

  const handleCompact = useCallback(() => {
    const slashSection = palette.sections.find(s => s.id === PanelSectionId.SlashCommands);
    const compactItem = slashSection?.items.find(item => item.label === '/compact');
    if (compactItem?.type === PanelItemType.Command) {
      (compactItem as CommandItem).action();
    }
  }, [palette.sections]);

  // 커맨드 팔레트 "Mention file..." 항목 연동
  useEffect(() => {
    const handleMentionFromPalette = () => {
      // handlePanelItemExecute가 action 실행 후 onChange('')로 값을 비우므로,
      // 그 이후에 @를 삽입하기 위해 다음 틱으로 지연
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        onChange('@');
        mention.detectMention('@', 1);

        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(1, 1);
        });
      }, 0);
    };
    window.addEventListener('command-palette:mention-file', handleMentionFromPalette);
    return () => window.removeEventListener('command-palette:mention-file', handleMentionFromPalette);
  }, [onChange, mention, textareaRef]);

  // Auto-resize textarea
  useTextareaAutoResize({ textareaRef, value });

  // Focus on session change or when input becomes enabled
  useEffect(() => {
    if (!disabled) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentSessionId, disabled, textareaRef]);

  // Focus textarea when window/document gains focus
  useEffect(() => {
    const handleFocus = () => {
      textareaRef.current?.focus();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [textareaRef]);

  // 세션 전환 시 ChatInput 로컬 상태 리셋
  const prevChatInputSessionRef = useRef(currentSessionId);
  useEffect(() => {
    const prev = prevChatInputSessionRef.current;
    prevChatInputSessionRef.current = currentSessionId;
    if (prev !== null && prev !== currentSessionId) {
      clearAttachments();
      inputHistory.initHistory([]);
      lastInitSessionRef.current = undefined;
    }
  }, [currentSessionId, clearAttachments, inputHistory]);

  const isActive = isStreaming
    || sessionState === SessionState.WaitingPermission
    || sessionState === SessionState.HasDiff;

  const isInterruptible = isActive;

  // ESC key: interrupt streaming or active state
  useEffect(() => {
    const handleEscKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isInterruptible) {
        e.preventDefault();
        onStop();
        // Re-focus textarea after interrupt
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isInterruptible, onStop, textareaRef]);

  // [KeyDebug] window 캡처 단계 Arrow 키 로깅
  useEffect(() => {
    const handleArrowCapture = (e: globalThis.KeyboardEvent) => {
      if (!e.key.startsWith('Arrow')) return;
      console.log('[KeyDebug:window-capture]', e.key, { altKey: e.altKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, defaultPrevented: e.defaultPrevented });
    };
    window.addEventListener('keydown', handleArrowCapture, true);
    return () => window.removeEventListener('keydown', handleArrowCapture, true);
  }, []);

  // Populate input history from session messages on session change
  useEffect(() => {
    if (!currentSessionId || currentSessionId === lastInitSessionRef.current) return;
    if (messages.length === 0) return;

    lastInitSessionRef.current = currentSessionId;

    const userTexts = messages
      .filter(m => m.type === LoadedMessageType.User)
      .map(m => getTextContent(m))
      .filter((t): t is string => Boolean(t));
    inputHistory.initHistory(userTexts);
  }, [currentSessionId, messages, inputHistory]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key.startsWith('Arrow')) console.log('[KeyDebug:textarea-keydown]', e.key, { altKey: e.altKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, defaultPrevented: e.defaultPrevented });

    // JCEF workaround: Cmd+Arrow 처리 후 발생하는 순수 Arrow 유령 이벤트 무시
    const isArrowKey = e.key.startsWith('Arrow');
    const hasModifier = e.metaKey || e.altKey || e.ctrlKey;
    if (isArrowKey && !hasModifier && Date.now() - lastMetaArrowTime.current < 50) {
      e.preventDefault();
      return;
    }

    // Shift+Tab: 모드 전환
    if (e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      cycleMode();
      return;
    }

    // JCEF workaround: Cmd+Arrow (macOS 줄 처음/끝 이동) 수동 처리
    // shiftKey가 있으면 선택 영역 확장이므로 기본 동작에 맡김
    if (e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey && isArrowKey) {
      const textarea = e.currentTarget;
      const pos = textarea.selectionStart;
      const text = textarea.value;

      e.preventDefault();
      lastMetaArrowTime.current = Date.now();

      if (e.key === 'ArrowLeft') {
        const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
        textarea.setSelectionRange(lineStart, lineStart);
      } else if (e.key === 'ArrowRight') {
        let lineEnd = text.indexOf('\n', pos);
        if (lineEnd === -1) lineEnd = text.length;
        textarea.setSelectionRange(lineEnd, lineEnd);
      } else if (e.key === 'ArrowUp') {
        textarea.setSelectionRange(0, 0);
      } else if (e.key === 'ArrowDown') {
        textarea.setSelectionRange(text.length, text.length);
      }
      return;
    }

    // Mention interaction (must precede slash command handling)
    if (mention.isActive && mention.handleKeyDown(e)) return;

    // Slash command interaction
    if (palette.handleSlashKeyDown(e, value)) return;

    // Enter: submit (IME 조합 중에는 무시)
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isMobile()) {
      e.preventDefault();
      if (!disabled && (value.trim() || attachments.length > 0)) {
        inputHistory.pushToHistory(value);
        onSubmit(undefined, mode, attachments.length > 0 ? attachments : undefined);
        clearAttachments();
      }
    } else if (e.key === 'ArrowUp' && !palette.showSlashCommands) {
      console.log('[KeyDebug:history-up-triggered]');
      // 복수행: 커서가 첫 번째 줄에 있을 때만 히스토리 탐색
      const pos = e.currentTarget.selectionStart;
      if (value.lastIndexOf('\n', pos - 1) !== -1) return;

      const historyValue = inputHistory.navigateUp(value);
      if (historyValue === null) return;
      e.preventDefault();
      onChange(historyValue);
    } else if (e.key === 'ArrowDown' && !palette.showSlashCommands) {
      console.log('[KeyDebug:history-down-triggered]');
      // 복수행: 커서가 마지막 줄에 있을 때만 히스토리 탐색
      const pos = e.currentTarget.selectionStart;
      if (value.indexOf('\n', pos) !== -1) return;

      const historyValue = inputHistory.navigateDown();
      if (historyValue === null) return;
      e.preventDefault();
      onChange(historyValue);
    }
  }, [disabled, value, attachments.length, onSubmit, inputHistory, onChange, palette, mention, cycleMode, clearAttachments, mode]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    palette.detectSlashCommand(newValue);
    mention.detectMention(newValue, e.target.selectionStart ?? newValue.length);
  }, [onChange, palette, mention]);

  const hasValue = !!value.trim() || attachments.length > 0;

  return (
    <div className="max-w-[44rem] mx-auto px-4 pb-[14px] pt-2">
      {/* 메인 인풋 컨테이너 */}
      <div
        className={`
          relative rounded-lg border bg-[#1e1e21]
          transition-colors duration-150
          ${isDragOver ? 'border-blue-500 bg-blue-500/5' : isFocused && mode !== 'plan' ? modeConfig.borderColor : 'border-zinc-700'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Mention dropdown */}
        {mention.isActive && !palette.showSlashCommands && (
          <div className="absolute bottom-full left-0 w-full z-20">
            <MentionDropdown
              results={mention.results}
              selectedIndex={mention.selectedIndex}
              isLoading={mention.isLoading}
              onSelect={mention.selectResult}
              onClose={mention.close}
            />
          </div>
        )}

        {/* Slash command panel */}
        {palette.showSlashCommands && (
          <div className="absolute bottom-full left-0 w-full z-20">
            <CommandPalettePanel
              sections={palette.filteredSections}
              selectedSectionIndex={palette.selectedSectionIndex}
              selectedItemIndex={palette.selectedItemIndex}
              onItemClick={palette.selectItem}
              onItemExecute={palette.handlePanelItemExecute}
              onClose={palette.closePanel}
            />
          </div>
        )}

        {/* Model switch panel */}
        {showModelSwitch && (
          <ModelSwitchOverlay onClose={() => setShowModelSwitch(false)} />
        )}

        {/* 드래그 오버 오버레이 */}
        <DragOverlay visible={isDragOver} />

        {/* Textarea 영역 */}
        <div className="pt-2.5 pb-1.5">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onPaste={handlePaste}
            placeholder={isStreaming ? "Queue another message..." : "⌘ Esc to focus or unfocus Claude"}
            disabled={disabled}
            rows={1}
            className="w-full px-3 cursor-text resize-none bg-transparent text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none disabled:opacity-50"
            style={{ minHeight: '20px', maxHeight: '200px' }}
          />
        </div>

        {/* 첨부 미리보기 */}
        <AttachmentPreview
          attachments={attachments}
          onRemove={removeAttachment}
        />

        {/* 에러 메시지 */}
        {attachmentError && (
          <div className="px-3 pb-1.5 text-xs text-red-400">
            {attachmentError}
          </div>
        )}

        {/* 구분선 */}
        <div className="border-t border-zinc-700/50" />

        {/* 하단 바: 모드 태그 + 파일 태그 + 액션 버튼 */}
        <div className="flex items-center justify-between px-[5px] py-[3px] h-[35px]">
          {/* 좌측: 모드 태그 + 파일 태그들 */}
          <div className="flex items-center gap-4">
            <InputModeTag mode={mode} onClick={cycleMode} />
            <ContextWindowTag onClick={handleCompact} disabled={isStreaming} />
          </div>

          {/* 우측: 액션 버튼들 + 첨부 드롭다운 메뉴 */}
          <div className="relative">
            <AttachMenu
              addImageAttachment={addImageAttachment}
              addFileAttachment={addFileAttachment}
              addFolderAttachment={addFolderAttachment}
              isOpen={showAttachMenu}
              onClose={() => setShowAttachMenu(false)}
            />
            <ActionButtons
              mode={mode}
              isActive={isActive}
              disabled={disabled}
              hasValue={hasValue}
              onAttach={() => setShowAttachMenu(prev => !prev)}
              onSlashCommand={palette.handleSlashButtonClick}
              onSubmit={() => {
                onSubmit(undefined, mode, attachments.length > 0 ? attachments : undefined);
                clearAttachments();
              }}
              onStop={onStop}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
