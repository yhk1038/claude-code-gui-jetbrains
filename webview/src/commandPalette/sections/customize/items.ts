import { IconType } from '@/types/commandPalette';
import { StaticItem } from '../../types';

export const customizeItems = [
  new StaticItem('output-styles', 'Output styles', { icon: IconType.Terminal }),
  new StaticItem('agents', 'Agents', { icon: IconType.Terminal }),
  new StaticItem('hooks', 'Hooks', { icon: IconType.Terminal }),
  new StaticItem('memory', 'Memory', { icon: IconType.Terminal }),
  new StaticItem('permissions', 'Permissions', { icon: IconType.Terminal }),
  new StaticItem('mcp-status', 'MCP status'),
  new StaticItem('manage-mcp', 'Manage MCP servers', { icon: IconType.Terminal }),
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
