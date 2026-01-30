import React, { useCallback, useRef, useEffect, KeyboardEvent, useState } from 'react';
import { AttachedContext } from '../hooks/useContext';
import { ContextChip } from './ContextChip';
import { SlashCommandPanel } from './SlashCommandPanel';
import { useSlashCommandPanel } from '../hooks/useSlashCommandPanel';
import { PanelItem } from '../types/slashCommandPanel';

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
  // New props for slash command panel
  currentModel?: string;
  thinkingEnabled?: boolean;
  onToggleThinking?: (enabled: boolean) => void;
  version?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isStreaming = false,
  isStopped = false,
  placeholder = "Queue another message...",
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
  sessionState = 'idle',
  currentModel,
  thinkingEnabled,
  onToggleThinking,
  version,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [unsavedDraft, setUnsavedDraft] = useState<string>('');
  const [showFileAutocomplete, setShowFileAutocomplete] = useState(false);
  const [, setAutocompleteQuery] = useState('');
  const [, setAtSymbolPosition] = useState<number | null>(null);
  const [showSlashCommands, setShowSlashCommands] = useState(false);

  // New slash command panel hook
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

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
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
  }, [disabled, isStreaming, value, onSubmit, history, historyIndex, unsavedDraft, onChange, showSlashCommands, moveSelection, executeSelectedItem, resetSelection]);

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

  return (
    <div className="border-t border-zinc-800 bg-zinc-950">
      {/* Context chips */}
      {attachedContexts.length > 0 && (
        <div className="border-b border-zinc-800 px-3 py-2">
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

      <div className="relative">
        {/* Slash command panel */}
        {showSlashCommands && (
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

        <div className="flex items-center">
          {/* 좌측: 상태 표시 */}
          <div className="flex items-center gap-2 px-3 py-3 text-xs border-r border-zinc-800 whitespace-nowrap">
            {sessionState === 'streaming' && (
              <>
                <span className="text-blue-500">●</span>
                <span className="text-blue-400">Generating</span>
              </>
            )}
            {sessionState === 'waiting_permission' && (
              <>
                <span className="text-amber-500">⚠</span>
                <span className="text-amber-400">Waiting</span>
              </>
            )}
            {sessionState === 'has_diff' && (
              <>
                <span className="text-green-500">✓</span>
                <span className="text-green-400">Has diff</span>
              </>
            )}
            {sessionState === 'error' && (
              <>
                <span className="text-red-500">✕</span>
                <span className="text-red-400">Error</span>
              </>
            )}
            {sessionState === 'idle' && (
              <>
                <span className="text-zinc-500">○</span>
                <span className="text-zinc-500">Idle</span>
              </>
            )}
          </div>

          {/* 중앙: 입력창 */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isStreaming}
            rows={1}
            className="flex-1 resize-none bg-transparent px-3 py-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none disabled:opacity-50"
            style={{ minHeight: '44px', maxHeight: '200px' }}
          />

          {/* 우측: 파일 첨부 + 전송 버튼 */}
          <div className="flex items-center px-2 gap-1">
            <button
              className="flex items-center justify-center w-8 h-8 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
              aria-label="Attach file"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>

            {isStreaming && onStop ? (
              <button
                onClick={onStop}
                className="flex items-center justify-center w-8 h-8 text-red-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                aria-label="Stop generating"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="5" y="5" width="6" height="6" rx="0.5" />
                </svg>
              </button>
            ) : isStopped && onContinue ? (
              <button
                onClick={onContinue}
                className="flex items-center justify-center w-8 h-8 text-blue-500 hover:text-blue-400 hover:bg-zinc-800 rounded transition-colors"
                aria-label="Continue generating"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 3l8 5-8 5V3z" />
                </svg>
              </button>
            ) : (
              <button
                onClick={onSubmit}
                disabled={disabled || isStreaming || !value.trim()}
                className="flex items-center justify-center w-8 h-8 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors disabled:text-zinc-700 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                aria-label="Send message"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 8l12-6-6 12-1-6-5-0z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
