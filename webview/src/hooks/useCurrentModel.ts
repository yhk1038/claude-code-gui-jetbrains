import { useChatStreamContext } from '@/contexts/ChatStreamContext';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';
import { resolveCurrentModel } from '@/types/models';

/**
 * The model to show as current in the composer and model picker. Combines the
 * running session model with the saved default via `resolveCurrentModel`, so a
 * new (not-yet-spawned) session reflects the user's Default Model setting
 * instead of always showing "Default".
 */
export function useCurrentModel(): string {
  const { sessionModel } = useChatStreamContext();
  const { settings } = useClaudeSettings();
  return resolveCurrentModel(sessionModel, settings.model);
}
