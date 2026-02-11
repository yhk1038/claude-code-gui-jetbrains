import { useState, useCallback, KeyboardEvent, RefObject } from 'react';
import { UseSlashCommandPanelReturn } from '../../../hooks/useSlashCommandPanel';
import { PanelItem } from '../../../types/slashCommandPanel';

interface UseSlashCommandInteractionOptions {
  panel: UseSlashCommandPanelReturn;
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

interface UseSlashCommandInteractionReturn {
  showSlashCommands: boolean;
  handleSlashKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>, currentValue: string) => boolean;
  detectSlashCommand: (newValue: string) => void;
  handlePanelItemExecute: (item: PanelItem) => void;
  handleSlashButtonClick: () => void;
  closePanel: () => void;
}

export function useSlashCommandInteraction({
  panel,
  onChange,
  textareaRef,
}: UseSlashCommandInteractionOptions): UseSlashCommandInteractionReturn {
  const [showSlashCommands, setShowSlashCommands] = useState(false);

  const executeAndClear = useCallback(() => {
    panel.executeSelectedItem();
    onChange('');
    setShowSlashCommands(false);
    panel.resetSelection();
  }, [panel, onChange]);

  const closePanel = useCallback(() => {
    setShowSlashCommands(false);
    panel.resetSelection();
  }, [panel]);

  const handleSlashKeyDown = useCallback((
    e: KeyboardEvent<HTMLTextAreaElement>,
    currentValue: string,
  ): boolean => {
    // Panel이 열려 있을 때
    if (showSlashCommands) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        executeAndClear();
        return true;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        panel.moveSelection('up');
        return true;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        panel.moveSelection('down');
        return true;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closePanel();
        return true;
      }
    }

    // Panel이 닫혀 있지만 value가 '/'로 시작할 때
    if (e.key === 'Enter' && !e.shiftKey && currentValue.startsWith('/')) {
      e.preventDefault();
      executeAndClear();
      return true;
    }

    return false;
  }, [showSlashCommands, executeAndClear, closePanel, panel]);

  const detectSlashCommand = useCallback((newValue: string) => {
    if (newValue.startsWith('/')) {
      const query = newValue.substring(1).split(' ')[0];
      setShowSlashCommands(true);
      panel.setFilterQuery(query);
      panel.resetSelection();
    } else {
      setShowSlashCommands(false);
      panel.resetSelection();
    }
  }, [panel]);

  const handlePanelItemExecute = useCallback((item: PanelItem) => {
    if (item.type === 'action' || item.type === 'command') {
      (item as any).action?.();
    }
    onChange('');
    setShowSlashCommands(false);
    panel.resetSelection();
  }, [onChange, panel]);

  const handleSlashButtonClick = useCallback(() => {
    if (!showSlashCommands) {
      onChange('/');
      setShowSlashCommands(true);
      panel.setFilterQuery('');
      panel.resetSelection();
      textareaRef.current?.focus();
    }
  }, [showSlashCommands, onChange, panel, textareaRef]);

  return {
    showSlashCommands,
    handleSlashKeyDown,
    detectSlashCommand,
    handlePanelItemExecute,
    handleSlashButtonClick,
    closePanel,
  };
}
