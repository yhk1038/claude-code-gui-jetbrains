import { useCallback, useEffect, KeyboardEvent, useState } from 'react';
import { SlashCommandPanel } from '../SlashCommandPanel';
import { InputMode, INPUT_MODES, MODE_CYCLE, ActiveFile } from '../../types/chatInput';
import { useInputMode } from './hooks/useInputMode';
import { InputModeTag } from './InputModeTag';
import { FileTag } from './FileTag';
import { ActionButtons } from './ActionButtons';
import { useChatInputFocus } from '../../contexts/ChatInputFocusContext';
import { useSlashCommandPanelConfig } from './hooks/useSlashCommandPanelConfig';
import { useInputHistory } from './hooks/useInputHistory';
import { useSlashCommandInteraction } from './hooks/useSlashCommandInteraction';
import { useTextareaAutoResize } from './hooks/useTextareaAutoResize';
import { useSettings } from '@/contexts/SettingsContext';
import { SettingKey } from '@/types/settings';

type SessionState = 'idle' | 'streaming' | 'waiting_permission' | 'has_diff' | 'error';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isStreaming?: boolean;
  isStopped?: boolean;
  placeholder?: string;
  disabled?: boolean;
  onStop?: () => void;
  onContinue?: () => void;
  onInit?: () => void;
  onReview?: () => void;
  onHelp?: () => void;
  onClear?: () => void;
  onCompact?: () => void;
  sessionState?: SessionState;
  currentModel?: string;
  thinkingEnabled?: boolean;
  onToggleThinking?: (enabled: boolean) => void;
  version?: string;
  inputMode?: InputMode;
  onInputModeChange?: (mode: InputMode) => void;
  activeFiles?: ActiveFile[];
  onFileToggle?: (path: string) => void;
  sessionId?: string | null;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isStreaming = false,
  isStopped = false,
  placeholder = '⌘ Esc to focus or unfocus Claude',
  disabled = false,
  onStop,
  onContinue,
  onInit,
  onReview,
  onHelp,
  onClear,
  onCompact,
  sessionState: _sessionState = 'idle',
  currentModel,
  thinkingEnabled,
  onToggleThinking,
  version,
  inputMode: externalInputMode,
  onInputModeChange,
  activeFiles = [],
  onFileToggle,
  sessionId,
}: ChatInputProps) {
  const { textareaRef } = useChatInputFocus();
  const inputHistory = useInputHistory();
  const [isFocused, setIsFocused] = useState(false);
  const { settings } = useSettings();

  // 내부 모드 상태 (외부에서 제어 가능)
  const { mode: internalMode, cycleMode: internalCycleMode } = useInputMode(
    settings[SettingKey.INITIAL_INPUT_MODE]
  );
  const mode = externalInputMode ?? internalMode;

  const cycleMode = useCallback(() => {
    if (onInputModeChange) {
      const currentIndex = MODE_CYCLE.indexOf(mode);
      const nextIndex = (currentIndex + 1) % MODE_CYCLE.length;
      onInputModeChange(MODE_CYCLE[nextIndex]);
    } else {
      internalCycleMode();
    }
  }, [mode, onInputModeChange, internalCycleMode]);

  const modeConfig = INPUT_MODES[mode];

  // Slash command panel hook
  const panel = useSlashCommandPanelConfig({
    onClear, onHelp, onInit, onReview, onCompact,
    currentModel, thinkingEnabled, onToggleThinking, version,
  });

  const slashCmd = useSlashCommandInteraction({
    panel,
    onChange,
    textareaRef,
  });

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
  }, [sessionId, disabled, textareaRef]);

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

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Tab: 모드 전환
    if (e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      cycleMode();
      return;
    }

    // Slash command interaction
    if (slashCmd.handleSlashKeyDown(e, value)) return;

    // Enter: submit
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isStreaming && value.trim()) {
        inputHistory.pushToHistory(value);
        onSubmit();
      }
    } else if (e.key === 'ArrowUp' && !slashCmd.showSlashCommands) {
      const historyValue = inputHistory.navigateUp(value);
      if (historyValue === null) return;
      e.preventDefault();
      onChange(historyValue);
    } else if (e.key === 'ArrowDown' && !slashCmd.showSlashCommands) {
      const historyValue = inputHistory.navigateDown();
      if (historyValue === null) return;
      e.preventDefault();
      onChange(historyValue);
    }
  }, [disabled, isStreaming, value, onSubmit, inputHistory, onChange, slashCmd, cycleMode]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    slashCmd.detectSlashCommand(newValue);
  }, [onChange, slashCmd]);

  return (
    <div className="px-3 pb-3 pt-2">
      {/* 메인 인풋 컨테이너 */}
      <div
        className={`
          relative rounded-lg border bg-zinc-900/80
          transition-colors duration-150
          ${isFocused && mode !== 'plan' ? modeConfig.borderColor : 'border-zinc-700'}
        `}
      >
        {/* Slash command panel */}
        {slashCmd.showSlashCommands && (
          <div className="absolute bottom-full left-0 mb-2 w-full z-20">
            <SlashCommandPanel
              sections={panel.filteredSections}
              selectedSectionIndex={panel.selectedSectionIndex}
              selectedItemIndex={panel.selectedItemIndex}
              onItemClick={panel.selectItem}
              onItemExecute={slashCmd.handlePanelItemExecute}
              onClose={slashCmd.closePanel}
            />
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
            placeholder={placeholder}
            disabled={disabled || isStreaming}
            rows={1}
            className="w-full px-3 cursor-text resize-none bg-transparent text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none disabled:opacity-50"
            style={{ minHeight: '20px', maxHeight: '200px' }}
          />
        </div>

        {/* 구분선 */}
        <div className="border-t border-zinc-700/50" />

        {/* 하단 바: 모드 태그 + 파일 태그 + 액션 버튼 */}
        <div className="flex items-center justify-between pl-2 pr-1 py-1">
          {/* 좌측: 모드 태그 + 파일 태그들 */}
          <div className="flex items-center gap-4">
            <InputModeTag mode={mode} onClick={cycleMode} />

            {activeFiles.map((file) => (
              <FileTag
                key={file.path}
                file={file}
                onClick={onFileToggle}
              />
            ))}
          </div>

          {/* 우측: 액션 버튼들 */}
          <ActionButtons
            mode={mode}
            isStreaming={isStreaming}
            isStopped={isStopped}
            disabled={disabled}
            hasValue={!!value.trim()}
            onSlashCommand={slashCmd.handleSlashButtonClick}
            onSubmit={onSubmit}
            onStop={onStop}
            onContinue={onContinue}
          />
        </div>
      </div>
    </div>
  );
}
