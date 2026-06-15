import { useEffect } from 'react';
import { Tag } from '@/pages/ChatPage/ChatInput/Tag';
import { useChatStreamContext } from '@/contexts/ChatStreamContext';
import { useCliConfig } from '@/contexts/CliConfigContext';
import { useSessionContext } from '@/contexts/SessionContext';
import { useBridge } from '@/hooks/useBridge';
import { SWITCH_MODEL_EVENT } from '@/pages/ChatPage/ModelSwitchOverlay';
import { DEFAULT_MODEL_ALIAS } from '@/types/models';
import { LoadedMessageType } from '@/types';
import type { ModelInfo } from '@/types/slashCommand';

/** Fired by the ⌘/Ctrl+Shift+. shortcut to rotate to the next model. */
export const ROTATE_MODEL_EVENT = 'rotate-model';

/**
 * Resolve the label to show for a model. The CLI's displayName hides the
 * real model behind generic labels ("Default (recommended)", "Sonnet"),
 * but the description's first "·"-separated segment carries the actual
 * model, e.g. "Opus 4.8 with 1M context · Best for everyday tasks".
 * Keep only the model name + version ("Opus 4.8"), dropping trailing
 * qualifiers; fall back to the full segment, then to displayName.
 */
function resolveModelLabel(info: ModelInfo): string {
  const firstSegment = info.description?.split('·')[0]?.trim();
  if (!firstSegment) return info.displayName;
  const nameVersion = firstSegment.match(/^.+?\s[\d.]+/);
  return nameVersion ? nameVersion[0].trim() : firstSegment;
}

/**
 * Always-on indicator of the current session model in the composer's
 * bottom bar. Clicking (or ⌘/Ctrl+Shift+M) opens the existing
 * `ModelSwitchOverlay`; ⌘/Ctrl+Shift+. rotates to the next model.
 *
 * The label is the real model name resolved from the CLI model info
 * (see `resolveModelLabel`). If the current model can't be resolved
 * (models not loaded yet), the tag renders nothing.
 */
export function ModelTag() {
  const { sessionModel, setSessionModel, appendMessage } = useChatStreamContext();
  const { controlResponse } = useCliConfig();
  const { currentSessionId } = useSessionContext();
  const { send } = useBridge();

  const models: ModelInfo[] = controlResponse?.response?.response?.models ?? [];

  useEffect(() => {
    const handleRotate = () => {
      if (models.length === 0) return;
      const current = sessionModel ?? DEFAULT_MODEL_ALIAS;
      const idx = models.findIndex((m) => m.value === current);
      const next = models[(idx + 1) % models.length];

      setSessionModel(next.value);
      appendMessage({
        type: LoadedMessageType.Notification,
        uuid: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        summary: `Set model to ${resolveModelLabel(next)}`,
      });
      if (currentSessionId) void send('SET_MODEL', { model: next.value });
    };

    window.addEventListener(ROTATE_MODEL_EVENT, handleRotate);
    return () => window.removeEventListener(ROTATE_MODEL_EVENT, handleRotate);
  }, [models, sessionModel, setSessionModel, appendMessage, currentSessionId, send]);

  const current = sessionModel ?? DEFAULT_MODEL_ALIAS;
  const info = models.find((m) => m.value === current);
  if (!info?.displayName) return null;

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent(SWITCH_MODEL_EVENT));
  };

  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const rotateHint = isMac ? '⌘⇧.' : 'Ctrl+Shift+.';

  return (
    <Tag title={`Switch model (${rotateHint})`} onClick={handleClick}>
      <span>{resolveModelLabel(info)}</span>
    </Tag>
  );
}
