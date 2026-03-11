import {
  PanelItemType,
  ActionItem,
  CommandItem,
  ToggleItem,
  PanelItem,
} from '@/types/commandPalette';
import { CommandPaletteCommand, SlashCommand, StaticToggleItem } from './types';

/**
 * Convert a CommandPaletteCommand to a PanelItem for rendering.
 * Toggle and Link branches removed (no registered items use these types).
 */
export function commandToItem(cmd: CommandPaletteCommand): PanelItem {
  const base = {
    id: cmd.id,
    label: cmd.label,
    type: cmd.type,
    icon: cmd.icon,
    valueComponent: cmd.valueComponent,
    disabled: cmd.disabled,
  };

  switch (cmd.type) {
    case PanelItemType.Command: {
      const slashCmd = cmd as SlashCommand;
      return {
        ...base,
        type: PanelItemType.Command,
        name: slashCmd.label,
        description: slashCmd.description,
        action: () => cmd.execute(),
      } as CommandItem;
    }
    case PanelItemType.Action:
      return {
        ...base,
        type: PanelItemType.Action,
        action: () => cmd.execute(),
      } as ActionItem;
    case PanelItemType.Toggle: {
      const toggleCmd = cmd as StaticToggleItem;
      return {
        ...base,
        type: PanelItemType.Toggle,
        toggled: toggleCmd.toggled,
        onToggle: toggleCmd.onToggle,
      } as ToggleItem;
    }
    default:
      return {
        ...base,
        type: PanelItemType.Info,
      } as PanelItem;
  }
}
