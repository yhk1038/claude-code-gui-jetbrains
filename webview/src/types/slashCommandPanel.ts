// ============================================
// Slash Command Panel Types
// ============================================

// Icon Types
export type IconType = 'terminal' | 'file' | 'settings' | 'link' | 'command';

// Panel Section Types
export type PanelSectionId =
  | 'context'
  | 'model'
  | 'customize'
  | 'slashCommands'
  | 'settings'
  | 'support';

// Panel Item Types
export type PanelItemType = 'action' | 'toggle' | 'link' | 'command' | 'info';

export interface PanelItemBase {
  id: string;
  label: string;
  type: PanelItemType;
  icon?: IconType;
  secondaryLabel?: string;
  disabled?: boolean;
  textStyle?: {
    underline?: boolean;
    italic?: boolean;
    align?: 'left' | 'right';
    size?: 'small' | 'normal';
    color?: 'primary' | 'secondary';
  };
}

export interface ActionItem extends PanelItemBase {
  type: 'action';
  action: () => void;
}

export interface ToggleItem extends PanelItemBase {
  type: 'toggle';
  toggled: boolean;
  onToggle: (value: boolean) => void;
}

export interface LinkItem extends PanelItemBase {
  type: 'link';
  href: string;
}

export interface CommandItem extends PanelItemBase {
  type: 'command';
  name: string;
  description: string;
  action: () => void;
}

export interface InfoItem extends PanelItemBase {
  type: 'info';
}

export type PanelItem = ActionItem | ToggleItem | LinkItem | CommandItem | InfoItem;

// Panel Section
export interface PanelSection {
  id: PanelSectionId;
  title: string;
  items: PanelItem[];
  scrollable?: boolean;
  maxHeight?: number;
  showDividerAbove: boolean;
}

// State Types
export interface SlashCommandPanelState {
  isOpen: boolean;
  filterQuery: string;
  selectedSectionIndex: number;
  selectedItemIndex: number;
}
