import { useSlashCommandPanel, UseSlashCommandPanelReturn } from '../../../hooks/useSlashCommandPanel';
import { getAdapter } from '@/adapters';

interface UseSlashCommandPanelConfigOptions {
  onClear?: () => void;
  onHelp?: () => void;
  onInit?: () => void;
  onReview?: () => void;
  onCompact?: () => void;
  currentModel?: string;
  thinkingEnabled?: boolean;
  onToggleThinking?: (enabled: boolean) => void;
  version?: string;
}

export function useSlashCommandPanelConfig(
  options: UseSlashCommandPanelConfigOptions
): UseSlashCommandPanelReturn {
  const { onClear, onHelp, onInit, onReview, onCompact, currentModel, thinkingEnabled, onToggleThinking, version } = options;

  return useSlashCommandPanel({
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
}
