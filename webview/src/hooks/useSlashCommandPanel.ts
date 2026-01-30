import { useState, useCallback, useMemo } from 'react';
import {
  PanelSection,
  ActionItem,
  ToggleItem,
  CommandItem,
} from '../types/slashCommandPanel';

const noop = () => {};

export interface UseSlashCommandPanelOptions {
  // Context Section Callbacks
  onAttachFile?: () => void;
  onMentionFile?: () => void;
  onClearConversation?: () => void;

  // Model Section Props & Callbacks
  currentModel?: string;
  thinkingEnabled?: boolean;
  onSwitchModel?: () => void;
  onToggleThinking?: (enabled: boolean) => void;
  onAccountUsage?: () => void;

  // Customize Section Callbacks
  onManageMCP?: () => void;
  onOutputStyles?: () => void;
  onAgents?: () => void;
  onHooks?: () => void;
  onMemory?: () => void;
  onPermissions?: () => void;
  onMCPStatus?: () => void;
  onManagePlugins?: () => void;
  onOpenTerminal?: () => void;

  // Slash Commands (Dynamic Registration)
  slashCommands?: Array<{
    name: string;
    description: string;
    action: () => void;
  }>;

  // Settings Section Callbacks
  onSwitchAccount?: () => void;
  onGeneralConfig?: () => void;

  // Support Section Props & Callbacks
  version?: string;
  reportProblemUrl?: string;
  onHelpDocs?: () => void;
}

export interface UseSlashCommandPanelReturn {
  sections: PanelSection[];
  filteredSections: PanelSection[];
  selectedSectionIndex: number;
  selectedItemIndex: number;
  filterQuery: string;
  setFilterQuery: (query: string) => void;
  selectItem: (sectionIndex: number, itemIndex: number) => void;
  executeSelectedItem: () => void;
  resetSelection: () => void;
  moveSelection: (direction: 'up' | 'down') => void;
  getTotalItemCount: () => number;
  getFlatIndex: () => number;
}

const buildSections = (options: UseSlashCommandPanelOptions): PanelSection[] => [
  {
    id: 'context',
    title: 'Context',
    showDividerAbove: false,
    items: [
      { id: 'attach-file', label: 'Attach file...', type: 'action', icon: 'file', action: options.onAttachFile ?? noop, disabled: !options.onAttachFile } as ActionItem,
      { id: 'mention-file', label: 'Mention file from this project...', type: 'action', icon: 'file', action: options.onMentionFile ?? noop, disabled: !options.onMentionFile } as ActionItem,
      { id: 'clear-conversation', label: 'Clear conversation', type: 'action', action: options.onClearConversation ?? noop, disabled: !options.onClearConversation } as ActionItem,
    ],
  },
  {
    id: 'model',
    title: 'Model',
    showDividerAbove: true,
    items: [
      { id: 'switch-model', label: 'Switch model...', type: 'action', secondaryLabel: options.currentModel, action: options.onSwitchModel ?? noop, disabled: !options.onSwitchModel } as ActionItem,
      { id: 'thinking', label: 'Thinking', type: 'toggle', toggled: options.thinkingEnabled ?? false, onToggle: options.onToggleThinking ?? noop, disabled: !options.onToggleThinking } as ToggleItem,
      { id: 'account-usage', label: 'Account & usage...', type: 'action', action: options.onAccountUsage ?? noop, disabled: !options.onAccountUsage } as ActionItem,
    ],
  },
  {
    id: 'customize',
    title: 'Customize',
    showDividerAbove: true,
    items: [
      { id: 'manage-mcp', label: 'Manage MCP servers', type: 'action', icon: 'terminal', action: options.onManageMCP ?? noop, disabled: !options.onManageMCP } as ActionItem,
      { id: 'output-styles', label: 'Output styles', type: 'action', icon: 'terminal', action: options.onOutputStyles ?? noop, disabled: !options.onOutputStyles } as ActionItem,
      { id: 'agents', label: 'Agents', type: 'action', icon: 'terminal', action: options.onAgents ?? noop, disabled: !options.onAgents } as ActionItem,
      { id: 'hooks', label: 'Hooks', type: 'action', icon: 'terminal', action: options.onHooks ?? noop, disabled: !options.onHooks } as ActionItem,
      { id: 'memory', label: 'Memory', type: 'action', icon: 'terminal', action: options.onMemory ?? noop, disabled: !options.onMemory } as ActionItem,
      { id: 'permissions', label: 'Permissions', type: 'action', icon: 'terminal', action: options.onPermissions ?? noop, disabled: !options.onPermissions } as ActionItem,
      { id: 'mcp-status', label: 'MCP status', type: 'action', action: options.onMCPStatus ?? noop, disabled: !options.onMCPStatus } as ActionItem,
      { id: 'manage-plugins', label: 'Manage plugins', type: 'action', action: options.onManagePlugins ?? noop, disabled: !options.onManagePlugins } as ActionItem,
      { id: 'open-terminal', label: 'Open Claude in Terminal', type: 'action', icon: 'terminal', action: options.onOpenTerminal ?? noop, disabled: !options.onOpenTerminal } as ActionItem,
    ],
  },
  {
    id: 'slashCommands',
    title: 'Slash Commands',
    showDividerAbove: true,
    scrollable: true,
    maxHeight: 200,
    items: (options.slashCommands ?? [])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(cmd => ({
        id: `cmd-${cmd.name}`,
        label: cmd.name,
        type: 'command' as const,
        icon: 'command' as const,
        name: cmd.name,
        description: cmd.description,
        action: cmd.action,
      } as CommandItem)),
  },
  {
    id: 'settings',
    title: 'Settings',
    showDividerAbove: true,
    items: [
      { id: 'switch-account', label: 'Switch account', type: 'action', action: options.onSwitchAccount ?? noop, disabled: !options.onSwitchAccount } as ActionItem,
      { id: 'general-config', label: 'General config...', type: 'action', action: options.onGeneralConfig ?? noop, disabled: !options.onGeneralConfig } as ActionItem,
    ],
  },
  {
    id: 'support',
    title: 'Support',
    showDividerAbove: true,
    items: [
      { id: 'help-docs', label: 'View help docs', type: 'action', action: options.onHelpDocs ?? noop, disabled: !options.onHelpDocs } as ActionItem,
    ],
  },
];

export function useSlashCommandPanel(options: UseSlashCommandPanelOptions): UseSlashCommandPanelReturn {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);

  const sections = useMemo(() => buildSections(options), [
    options.currentModel,
    options.thinkingEnabled,
    options.version,
    options.slashCommands,
  ]);

  const filteredSections = useMemo(() => {
    if (!filterQuery) return sections;

    // When filtering, only show Slash Commands section with filtered results
    const slashCommandsSection = sections.find(s => s.id === 'slashCommands');
    if (!slashCommandsSection) return [];

    const filteredItems = slashCommandsSection.items.filter(item =>
      item.label.toLowerCase().includes(filterQuery.toLowerCase())
    );

    if (filteredItems.length === 0) return [];

    return [{
      ...slashCommandsSection,
      showDividerAbove: false,
      items: filteredItems,
    }];
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
        // Wrap to beginning
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
        // Wrap to end
        newSectionIndex = sectionsToUse.length - 1;
        newItemIndex = sectionsToUse[newSectionIndex].items.length - 1;
      }
    }

    setSelectedSectionIndex(newSectionIndex);
    setSelectedItemIndex(newItemIndex);
  }, [filteredSections, selectedSectionIndex, selectedItemIndex]);

  const executeSelectedItem = useCallback(() => {
    const section = filteredSections[selectedSectionIndex];
    if (!section) return;

    const item = section.items[selectedItemIndex];
    if (!item) return;

    if (item.type === 'action' || item.type === 'command') {
      (item as ActionItem | CommandItem).action();
    } else if (item.type === 'toggle') {
      const toggleItem = item as ToggleItem;
      toggleItem.onToggle(!toggleItem.toggled);
    } else if (item.type === 'link') {
      window.open((item as any).href, '_blank');
    }
  }, [filteredSections, selectedSectionIndex, selectedItemIndex]);

  return {
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
  };
}
