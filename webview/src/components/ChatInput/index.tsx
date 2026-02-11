import { useCallback, useRef, useEffect, KeyboardEvent, useState } from 'react';
import { AttachedContext } from '../../hooks/useContext';
import { ContextChip } from '../ContextChip';
import { SlashCommandPanel } from '../SlashCommandPanel';
import { useSlashCommandPanel } from '../../hooks/useSlashCommandPanel';
import { PanelItem } from '../../types/slashCommandPanel';
import { InputMode, INPUT_MODES, ActiveFile } from '../../types/chatInput';
import { useInputMode } from './hooks/useInputMode';
import { InputModeTag } from './InputModeTag';
import { FileTag } from './FileTag';
import { ActionButtons } from './ActionButtons';
import { getAdapter } from '@/adapters';
import { useChatInputFocus } from '../../contexts/ChatInputFocusContext';

type SessionState = 'idle' | 'streaming' | 'waiting_permission' | 'has_diff' | 'error';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isStreaming?: boolean;
  isStopped?: boolean;
  placeholder?: string;
  disabled?: boolean;
  attachedContexts?: AttachedContext[];
  onRemoveContext?: (id: string) => void;
  onAddContext?: (path: string) => void;
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
  // 새로운 props
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
  attachedContexts = [],
  onRemoveContext,
  onAddContext,
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { registerRef, focus: focusInput } = useChatInputFocus();
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [unsavedDraft, setUnsavedDraft] = useState<string>('');
  const [showFileAutocomplete, setShowFileAutocomplete] = useState(false);
  const [, setAutocompleteQuery] = useState('');
  const [, setAtSymbolPosition] = useState<number | null>(null);
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // 내부 모드 상태 (외부에서 제어 가능)
  const { mode: internalMode, cycleMode: internalCycleMode } = useInputMode('ask_before_edit');
  const mode = externalInputMode ?? internalMode;

  const cycleMode = useCallback(() => {
    if (onInputModeChange) {
      const currentIndex = ['plan', 'ask_before_edit', 'auto_edit', 'bypass'].indexOf(mode);
      const nextIndex = (currentIndex + 1) % 4;
      const nextMode = ['plan', 'ask_before_edit', 'auto_edit', 'bypass'][nextIndex] as InputMode;
      onInputModeChange(nextMode);
    } else {
      internalCycleMode();
    }
  }, [mode, onInputModeChange, internalCycleMode]);

  const modeConfig = INPUT_MODES[mode];

  // Slash command panel hook
  const {
    filteredSections,
    selectedSectionIndex,
    selectedItemIndex,
    setFilterQuery,
    selectItem,
    executeSelectedItem,
    resetSelection,
    moveSelection,
  } = useSlashCommandPanel({
    onClearConversation: onClear,
    onHelpDocs: onHelp,
    onGeneralConfig: () => {
      getAdapter().openSettings().catch((error) => {
        console.error('[ChatInput] Failed to open settings:', error);
      });
    },
    currentModel,
    thinkingEnabled,
    onToggleThinking,
    version,
    slashCommands: [
      { name: '/init', description: 'Initialize Claude in project', action: onInit ?? (() => {}) },
      { name: '/review', description: 'Review current file', action: onReview ?? (() => {}) },
      { name: '/help', description: 'Show help information', action: onHelp ?? (() => {}) },
      { name: '/clear', description: 'Clear conversation', action: onClear ?? (() => {}) },
      { name: '/compact', description: 'Compact conversation', action: onCompact ?? (() => {}) },
    ],
  });

  // Register textarea ref with context
  useEffect(() => {
    registerRef(textareaRef.current);
    return () => registerRef(null);
  }, [registerRef]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  // Focus on session change or when input becomes enabled
  useEffect(() => {
    if (!disabled) {
      focusInput();
    }
  }, [sessionId, disabled, focusInput]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Tab: 모드 전환
    if (e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      cycleMode();
      return;
    }

    // Slash command panel navigation
    if (showSlashCommands) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection('up');
        return;
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection('down');
        return;
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        executeSelectedItem();
        onChange('');
        setShowSlashCommands(false);
        resetSelection();
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashCommands(false);
        resetSelection();
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isStreaming && value.trim()) {
        // Check if it's a slash command
        if (value.startsWith('/')) {
          executeSelectedItem();
          onChange('');
          setShowSlashCommands(false);
          resetSelection();
        } else {
          setHistory((prev) => [...prev, value]);
          setHistoryIndex(-1);
          setUnsavedDraft('');
          onSubmit();
        }
      }
    } else if (e.key === 'ArrowUp' && !showSlashCommands) {
      if (history.length === 0) return;
      e.preventDefault();

      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(historyIndex - 1, 0);
      setHistoryIndex(newIndex);

      if (historyIndex === -1) {
        setUnsavedDraft(value);
      }

      onChange(history[newIndex]);
    } else if (e.key === 'ArrowDown' && !showSlashCommands) {
      if (history.length === 0) return;
      e.preventDefault();

      if (historyIndex === -1) return;

      const newIndex = historyIndex + 1;

      if (newIndex >= history.length) {
        setHistoryIndex(-1);
        onChange(unsavedDraft);
      } else {
        setHistoryIndex(newIndex);
        onChange(history[newIndex]);
      }
    }
  }, [disabled, isStreaming, value, onSubmit, history, historyIndex, unsavedDraft, onChange, showSlashCommands, moveSelection, executeSelectedItem, resetSelection, cycleMode]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Check for slash command trigger at start
    if (newValue.startsWith('/')) {
      const query = newValue.substring(1).split(' ')[0];
      setShowSlashCommands(true);
      setFilterQuery(query);
      resetSelection();
    } else {
      setShowSlashCommands(false);
      resetSelection();
    }

    // Check for @ trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setShowFileAutocomplete(true);
        setAutocompleteQuery(textAfterAt);
        setAtSymbolPosition(lastAtIndex);
      } else {
        setShowFileAutocomplete(false);
        setAtSymbolPosition(null);
      }
    } else {
      setShowFileAutocomplete(false);
      setAtSymbolPosition(null);
    }
  }, [onChange, setFilterQuery, resetSelection]);

  const handlePanelItemExecute = useCallback((item: PanelItem) => {
    if (item.type === 'action' || item.type === 'command') {
      (item as any).action?.();
    }
    onChange('');
    setShowSlashCommands(false);
    resetSelection();
  }, [onChange, resetSelection]);

  const handleSlashButtonClick = useCallback(() => {
    if (!showSlashCommands) {
      onChange('/');
      setShowSlashCommands(true);
      setFilterQuery('');
      resetSelection();
      textareaRef.current?.focus();
    }
  }, [showSlashCommands, onChange, setFilterQuery, resetSelection]);

  return (
    <div className="px-3 pb-3 pt-2">
      {/* Context chips */}
      {attachedContexts.length > 0 && (
        <div className="mb-2">
          <div className="flex flex-wrap gap-2">
            {attachedContexts.map(context => (
              <ContextChip
                key={context.id}
                context={context}
                onRemove={onRemoveContext || (() => {})}
              />
            ))}
          </div>
        </div>
      )}

      {/* 메인 인풋 컨테이너 */}
      <div
        className={`
          relative rounded-lg border bg-zinc-900/80
          transition-colors duration-150
          ${isFocused && mode !== 'plan' ? modeConfig.borderColor : 'border-zinc-700'}
        `}
      >
        {/* Slash command panel */}
        {showSlashCommands && (
          <div className="absolute bottom-full left-0 mb-2 w-full z-20">
            <SlashCommandPanel
              sections={filteredSections}
              selectedSectionIndex={selectedSectionIndex}
              selectedItemIndex={selectedItemIndex}
              onItemClick={selectItem}
              onItemExecute={handlePanelItemExecute}
              onClose={() => {
                setShowSlashCommands(false);
                resetSelection();
              }}
            />
          </div>
        )}

        {/* File autocomplete popup */}
        {showFileAutocomplete && onAddContext && !showSlashCommands && (
          <div className="absolute bottom-full left-0 mb-2 w-full max-w-md bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl shadow-black/40 overflow-hidden z-10">
            <div className="p-2 border-b border-zinc-700/50">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.5 2a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5h7zm-7-1A1.5 1.5 0 0 0 3 2.5v11A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 11.5 1h-7z"/>
                </svg>
                <span className="font-mono">@file mention</span>
              </div>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto">
              <div className="text-xs text-zinc-500 text-center py-4 font-mono">
                File search from IDE bridge (to be implemented)
              </div>
            </div>
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
            className="w-full px-3 resize-none bg-transparent text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none disabled:opacity-50"
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
            onSlashCommand={handleSlashButtonClick}
            onSubmit={onSubmit}
            onStop={onStop}
            onContinue={onContinue}
          />
        </div>
      </div>
    </div>
  );
}
