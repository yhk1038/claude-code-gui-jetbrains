import { useEffect, useRef } from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';
import { useChatStreamContext } from '@/contexts/ChatStreamContext';
import { useBridge } from '@/hooks/useBridge';
import { useSessionContext } from '@/contexts/SessionContext';
import { useCliConfig } from '@/contexts/CliConfigContext';
import { useCurrentModel } from '@/hooks/useCurrentModel';
import { useVersionInfo } from '@/hooks/useVersionInfo';
import { LoadedMessageType } from '@/types';
import {
  FABLE_PROMO_BADGE,
  isFablePromoActive,
  resolveModelInfo,
  resolveModelLabel,
  toModelAlias,
  withFableFallback,
} from '@/types/models';
import type { ModelInfo } from '@/types/slashCommand';
import { MessageType } from '@/shared';

export const SWITCH_MODEL_EVENT = 'switch-model';

interface ModelSwitchOverlayProps {
  onClose: () => void;
}

export function ModelSwitchOverlay({ onClose }: ModelSwitchOverlayProps) {
  const { setSessionModel, appendMessage } = useChatStreamContext();
  const { send } = useBridge();
  const { currentSessionId } = useSessionContext();
  const { controlResponse } = useCliConfig();
  const currentModel = useCurrentModel();
  const { cliVersion } = useVersionInfo();
  const panelRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const models: ModelInfo[] = withFableFallback(controlResponse?.response?.response?.models ?? [], now, cliVersion);
  const currentInfo = resolveModelInfo(models, currentModel);
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const promoActive = isFablePromoActive(now);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleSelect = async (value: string) => {
    setSessionModel(value);

    // Instant local feedback (same label & dedup behavior as the rotate path):
    // the CLI's `/model` echo only appears on the next send, so this shows the
    // change immediately; UserMessageRenderer dedupes the echo against it.
    const info = models.find((m) => m.value === value);
    appendMessage({
      type: LoadedMessageType.Notification,
      uuid: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      summary: `Set model to ${info ? resolveModelLabel(info) : value}`,
    });

    if (currentSessionId) {
      await send(MessageType.SET_MODEL, { model: value });
    }

    onClose();
  };

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '0',
        marginBottom: '12px',
        width: 'calc(100%)',
        backgroundColor: 'var(--panel-bg, #252526)',
        borderRadius: 'var(--panel-radius, 6px)',
        boxShadow: 'var(--panel-shadow, 0 4px 12px rgba(0,0,0,0.3))',
        zIndex: 100,
        border: '1px solid var(--divider-color, #3c3c3c)',
      }}
    >
      {/* Header */}
      <div className="pt-1 pb-1.5 px-3 text-[0.9230rem] text-text-tertiary flex items-center justify-between">
        <span>Select a model</span>
        <kbd className="inline-flex items-center px-1.5 py-0.5 bg-surface-tooltip rounded text-text-secondary text-xs font-mono">
          {isMac ? '⌘⇧M' : 'Ctrl+Shift+M'}
        </kbd>
      </div>

      {/* Model list */}
      <div className="pb-1.5 px-1">
        {models.length === 0 ? (
          <div className="px-2 py-1 text-[0.9230rem] text-text-tertiary">Loading models…</div>
        ) : models.map((m) => {
          const selected = m.value === currentInfo?.value;
          return (
            <button
              key={m.value}
              onClick={() => void handleSelect(m.value)}
              className={`w-full relative flex items-center justify-between px-2 py-1 rounded-md text-left transition-colors ${
                selected ? 'bg-surface-hover' : 'hover:bg-surface-hover'
              }`}
            >
              <span className="flex flex-col min-w-0">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="leading-tight text-[1rem] truncate text-text-primary">
                    {m.displayName}
                  </span>
                  {toModelAlias(m.value) === 'fable' && promoActive && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[0.7692rem] bg-surface-tooltip text-text-secondary whitespace-nowrap">
                      {FABLE_PROMO_BADGE}
                    </span>
                  )}
                </span>
                <span className="leading-normal text-[0.8461rem] truncate text-text-secondary/80">
                  {m.description}
                </span>
              </span>
              {selected && (
                <CheckIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 flex-shrink-0 text-text-secondary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
