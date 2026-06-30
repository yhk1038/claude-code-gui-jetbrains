import { IconType } from '@/types/commandPalette';
import { StaticItem } from '../../types';

export const OPEN_MCP_MODAL_EVENT = 'open-mcp-modal';

export const customizeItems = [
  new StaticItem('output-styles', 'Output styles'),
  new StaticItem('agents', 'Agents'),
  new StaticItem('hooks', 'Hooks'),
  new StaticItem('memory', 'Memory'),
  new StaticItem('permissions', 'Permissions'),
  new StaticItem('manage-mcp', 'MCP Servers', {
    disabled: false,
    action: async () => {
      window.dispatchEvent(new CustomEvent(OPEN_MCP_MODAL_EVENT));
    },
  }),
  new StaticItem('manage-plugins', 'Manage plugins'),
  new StaticItem('open-terminal', 'Open Claude in Terminal', {
    icon: IconType.Terminal,
    disabled: false,
    serviceAction: async (services) => {
      const workingDir = services.session.workingDirectory ?? '';
      await services.adapter.openTerminal(workingDir);
    },
  }),
];
