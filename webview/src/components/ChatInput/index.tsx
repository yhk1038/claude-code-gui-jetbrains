import { useCallback, useEffect, useRef, KeyboardEvent, useState } from 'react';
import { CommandPalettePanel } from '@/commandPalette/ui/CommandPalettePanel';
import { useCommandPalette } from '@/commandPalette/hooks/useCommandPalette';
import { PanelSectionId, PanelItemType, CommandItem } from '@/types/commandPalette';
import { INPUT_MODES } from '../../types/chatInput';
import { useInputMode } from './hooks/useInputMode';
import { InputModeTag } from './InputModeTag';
import { ActionButtons } from './ActionButtons';
import { useChatInputFocus } from '../../contexts/ChatInputFocusContext';
import { useInputHistory } from './hooks/useInputHistory';
import { useTextareaAutoResize } from './hooks/useTextareaAutoResize';
import { useSettings } from '@/contexts/SettingsContext';
import { useSessionContext } from '@/contexts/SessionContext';
import { useChatStreamContext } from '@/contexts/ChatStreamContext';
import { SettingKey } from '@/types/settings';
import { getTextContent, SessionState } from '@/types';
import { LoadedMessageType } from '@/dto';
import { useAttachments } from './hooks/useAttachments';
import { AttachmentPreview } from './AttachmentPreview';
import { ContextWindowTag } from './ContextWindowTag';

export function ChatInput() {
  const { textareaRef } = useChatInputFocus();
  const { currentSessionId, sessionState, workingDirectory } = useSessionContext();
  const {
    messages,
    input: value,
    setInput: onChange,
    handleSubmit: onSubmit,
    isStreaming,
    isStopped,
    stop: onStop,
    continue: onContinue,
  } = useChatStreamContext();
  const inputHistory = useInputHistory();
  const [isFocused, setIsFocused] = useState(false);
  const lastInitSessionRef = useRef<string | undefined>(undefined);
  const { settings } = useSettings();

  const {
    attachments,
    addAttachment,
    removeAttachment,
    clearAttachments,
    error: attachmentError,
    isDragOver,
    setIsDragOver,
  } = useAttachments();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const disabled = sessionState === SessionState.Error || !workingDirectory;

  const { mode, cycleMode } = useInputMode(
    settings[SettingKey.INITIAL_INPUT_MODE]
  );

  const modeConfig = INPUT_MODES[mode];

  const palette = useCommandPalette({ onChange, textareaRef });

  const handleCompact = useCallback(() => {
    const slashSection = palette.sections.find(s => s.id === PanelSectionId.SlashCommands);
    const compactItem = slashSection?.items.find(item => item.label === '/compact');
    if (compactItem?.type === PanelItemType.Command) {
      (compactItem as CommandItem).action();
    }
  }, [palette.sections]);

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

  // ESC key: interrupt streaming
  useEffect(() => {
    const handleEscKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isStreaming) {
        e.preventDefault();
        onStop();
        // Re-focus textarea after interrupt
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isStreaming, onStop, textareaRef]);

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

  const handleAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await addAttachment(file);
    }
    e.target.value = ''; // reset for re-selection
  }, [addAttachment]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length === 0) return; // 텍스트 붙여넣기는 기존 동작 유지

    e.preventDefault(); // 이미지가 있을 때만 기본 동작 차단
    for (const file of imageFiles) {
      await addAttachment(file);
    }
  }, [addAttachment]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, [setIsDragOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, [setIsDragOver]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        await addAttachment(file);
      }
    }
  }, [addAttachment, setIsDragOver]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Tab: 모드 전환
    if (e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      cycleMode();
      return;
    }

    // Slash command interaction
    if (palette.handleSlashKeyDown(e, value)) return;

    // Enter: submit
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isStreaming && (value.trim() || attachments.length > 0)) {
        inputHistory.pushToHistory(value);
        onSubmit(undefined, mode, attachments.length > 0 ? attachments : undefined);
        clearAttachments();
      }
    } else if (e.key === 'ArrowUp' && !palette.showSlashCommands) {
      // 복수행: 커서가 첫 번째 줄에 있을 때만 히스토리 탐색
      const pos = e.currentTarget.selectionStart;
      if (value.lastIndexOf('\n', pos - 1) !== -1) return;

      const historyValue = inputHistory.navigateUp(value);
      if (historyValue === null) return;
      e.preventDefault();
      onChange(historyValue);
    } else if (e.key === 'ArrowDown' && !palette.showSlashCommands) {
      // 복수행: 커서가 마지막 줄에 있을 때만 히스토리 탐색
      const pos = e.currentTarget.selectionStart;
      if (value.indexOf('\n', pos) !== -1) return;

      const historyValue = inputHistory.navigateDown();
      if (historyValue === null) return;
      e.preventDefault();
      onChange(historyValue);
    }
  }, [disabled, isStreaming, value, attachments.length, onSubmit, inputHistory, onChange, palette, cycleMode, clearAttachments]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    palette.detectSlashCommand(newValue);
  }, [onChange, palette]);

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

        {/* 드래그 오버 오버레이 */}
        {isDragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-blue-500/10 border-2 border-dashed border-blue-500/50 pointer-events-none">
            <span className="text-blue-400 text-sm font-medium">Drop images here</span>
          </div>
        )}

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
            placeholder="⌘ Esc to focus or unfocus Claude"
            disabled={disabled || isStreaming}
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
            <ContextWindowTag onClick={handleCompact} />
          </div>

          {/* 우측: 액션 버튼들 */}
          <ActionButtons
            mode={mode}
            isStreaming={isStreaming}
            isStopped={isStopped}
            disabled={disabled}
            hasValue={hasValue}
            onAttach={handleAttach}
            onSlashCommand={palette.handleSlashButtonClick}
            onSubmit={() => {
              onSubmit(undefined, mode, attachments.length > 0 ? attachments : undefined);
              clearAttachments();
            }}
            onStop={onStop}
            onContinue={onContinue}
          />
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
}
