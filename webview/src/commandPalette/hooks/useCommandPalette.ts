import { useState, useCallback, useMemo, KeyboardEvent, RefObject } from 'react';
import { PanelSection, PanelItemType, ActionItem, CommandItem, PanelItem } from '@/types/commandPalette';
import { useCommandPaletteRegistry } from '../CommandPaletteProvider';

interface UseCommandPaletteOptions {
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export function useCommandPalette({ onChange, textareaRef }: UseCommandPaletteOptions) {
  const { sections } = useCommandPaletteRegistry();

  // --- Panel state (from useSlashCommandPanel) ---
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [showSlashCommands, setShowSlashCommands] = useState(false);

  const filteredSections = useMemo(() => {
    if (!filterQuery) return sections;

    const query = filterQuery.toLowerCase();
    return sections
      .map((section, index) => {
        const filteredItems = section.items.filter(item =>
          item.label.toLowerCase().includes(query)
        );
        if (filteredItems.length === 0) return null;
        return {
          ...section,
          showDividerAbove: index > 0,
          items: filteredItems,
        };
      })
      .filter((section): section is PanelSection => section !== null);
  }, [sections, filterQuery]);

  const selectItem = useCallback((sectionIndex: number, itemIndex: number) => {
    setSelectedSectionIndex(sectionIndex);
    setSelectedItemIndex(itemIndex);
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedSectionIndex(0);
    setSelectedItemIndex(0);
    setFilterQuery('');
  }, []);

  const getTotalItemCount = useCallback(() => {
    return filteredSections.reduce((count, section) => count + section.items.length, 0);
  }, [filteredSections]);

  const getFlatIndex = useCallback(() => {
    let flatIndex = 0;
    for (let i = 0; i < selectedSectionIndex; i++) {
      flatIndex += filteredSections[i]?.items.length ?? 0;
    }
    return flatIndex + selectedItemIndex;
  }, [filteredSections, selectedSectionIndex, selectedItemIndex]);

  const moveSelection = useCallback((direction: 'up' | 'down') => {
    const sectionsToUse = filteredSections;
    if (sectionsToUse.length === 0) return;

    let newSectionIndex = selectedSectionIndex;
    let newItemIndex = selectedItemIndex;

    if (direction === 'down') {
      const currentSection = sectionsToUse[newSectionIndex];
      if (!currentSection) return;

      if (newItemIndex < currentSection.items.length - 1) {
        newItemIndex++;
      } else if (newSectionIndex < sectionsToUse.length - 1) {
        newSectionIndex++;
        newItemIndex = 0;
      } else {
        newSectionIndex = 0;
        newItemIndex = 0;
      }
    } else {
      if (newItemIndex > 0) {
        newItemIndex--;
      } else if (newSectionIndex > 0) {
        newSectionIndex--;
        newItemIndex = sectionsToUse[newSectionIndex].items.length - 1;
      } else {
        newSectionIndex = sectionsToUse.length - 1;
        newItemIndex = sectionsToUse[newSectionIndex].items.length - 1;
      }
    }

    setSelectedSectionIndex(newSectionIndex);
    setSelectedItemIndex(newItemIndex);
  }, [filteredSections, selectedSectionIndex, selectedItemIndex]);

  // Toggle/Link branches removed - no registered items use these types
  const executeSelectedItem = useCallback(() => {
    const section = filteredSections[selectedSectionIndex];
    if (!section) return;

    const item = section.items[selectedItemIndex];
    if (!item) return;

    if (item.type === PanelItemType.Action || item.type === PanelItemType.Command) {
      (item as ActionItem | CommandItem).action();
    }
  }, [filteredSections, selectedSectionIndex, selectedItemIndex]);

  // --- Interaction (from useSlashCommandInteraction) ---

  const executeAndClear = useCallback(() => {
    executeSelectedItem();
    onChange('');
    setShowSlashCommands(false);
    resetSelection();
  }, [executeSelectedItem, onChange, resetSelection]);

  const closePanel = useCallback(() => {
    setShowSlashCommands(false);
    resetSelection();
  }, [resetSelection]);

  const handleSlashKeyDown = useCallback((
    e: KeyboardEvent<HTMLTextAreaElement>,
    currentValue: string,
  ): boolean => {
    if (!showSlashCommands) return false;

    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      const hasItems = filteredSections.some(s => s.items.length > 0);
      if (hasItems) {
        e.preventDefault();
        executeAndClear();
        return true;
      }
      // No matching command — close panel, let normal submit handle it
      closePanel();
      return false;
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const section = filteredSections[selectedSectionIndex];
      const item = section?.items[selectedItemIndex];
      if (item && item.type === PanelItemType.Command) {
        const firstSpaceIdx = currentValue.indexOf(' ');
        const rest = firstSpaceIdx === -1 ? ' ' : currentValue.slice(firstSpaceIdx);
        onChange(`${(item as CommandItem).name}${rest}`);
        closePanel();
      }
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveSelection('up');
      return true;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelection('down');
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
      return true;
    }

    return false;
  }, [showSlashCommands, filteredSections, selectedSectionIndex, selectedItemIndex, executeAndClear, closePanel, moveSelection, onChange]);

  const detectSlashCommand = useCallback((newValue: string) => {
    if (newValue.startsWith('/')) {
      const query = newValue.substring(1).split(' ')[0];
      setShowSlashCommands(true);
      setFilterQuery(query);
      setSelectedSectionIndex(0);
      setSelectedItemIndex(0);
    } else {
      setShowSlashCommands(false);
      resetSelection();
    }
  }, [resetSelection]);

  const handlePanelItemExecute = useCallback((item: PanelItem) => {
    if (item.type === PanelItemType.Action || item.type === PanelItemType.Command) {
      (item as any).action?.();
    }
    if (item.keepOpen) return;
    onChange('');
    setShowSlashCommands(false);
    resetSelection();
  }, [onChange, resetSelection]);

  const handleSlashButtonClick = useCallback(() => {
    if (!showSlashCommands) {
      onChange('/');
      setShowSlashCommands(true);
      setFilterQuery('');
      setSelectedSectionIndex(0);
      setSelectedItemIndex(0);
      textareaRef.current?.focus();
    }
  }, [showSlashCommands, onChange, textareaRef]);

  return {
    // Panel state
    sections,
    filteredSections,
    selectedSectionIndex,
    selectedItemIndex,
    filterQuery,
    setFilterQuery,
    selectItem,
    executeSelectedItem,
    resetSelection,
    moveSelection,
    getTotalItemCount,
    getFlatIndex,
    // Interaction
    showSlashCommands,
    handleSlashKeyDown,
    detectSlashCommand,
    handlePanelItemExecute,
    handleSlashButtonClick,
    closePanel,
  };
}
