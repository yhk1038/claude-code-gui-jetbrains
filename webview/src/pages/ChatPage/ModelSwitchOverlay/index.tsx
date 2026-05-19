import { useEffect, useRef } from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';
import { useChatStreamContext } from '@/contexts/ChatStreamContext';
import { useBridge } from '@/hooks/useBridge';
import { useSessionContext } from '@/contexts/SessionContext';
import { useCliConfig } from '@/contexts/CliConfigContext';
import { LoadedMessageType } from '@/types';
import { DEFAULT_MODEL_ALIAS } from '@/types/models';
import type { ModelInfo } from '@/types/slashCommand';

export const SWITCH_MODEL_EVENT = 'switch-model';

interface ModelSwitchOverlayProps {
  onClose: () => void;
}

export function ModelSwitchOverlay({ onClose }: ModelSwitchOverlayProps) {
  const { sessionModel, setSessionModel, appendMessage } = useChatStreamContext();
  const { send } = useBridge();
  const { currentSessionId } = useSessionContext();
  const { controlResponse } = useCliConfig();
  const panelRef = useRef<HTMLDivElement>(null);

  const models: ModelInfo[] = controlResponse?.response?.response?.models ?? [];
  const currentModel = sessionModel ?? DEFAULT_MODEL_ALIAS;

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

    const info = models.find((m) => m.value === value);
    const notificationText = info
      ? `Set model to ${info.displayName}`
      : `Set model to ${value}`;

    appendMessage({
      type: LoadedMessageType.Notification,
      uuid: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      summary: notificationText,
    });

    if (currentSessionId) {
      await send('SET_MODEL', { model: value });
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
      <div className="pt-1 pb-1.5 px-3 text-[12px] text-zinc-500">
        Select a model
      </div>

      {/* Model list */}
      <div className="pb-1.5 px-1">
        {models.length === 0 ? (
          <div className="px-2 py-1 text-[12px] text-zinc-500">Loading models…</div>
        ) : models.map((m) => {
          const selected = currentModel === m.value;
          return (
            <button
              key={m.value}
              onClick={() => void handleSelect(m.value)}
              className={`w-full relative flex items-center justify-between px-2 py-1 rounded-md text-left transition-colors ${
                selected ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <span className="flex flex-col min-w-0">
                <span className={`leading-tight text-[13px] truncate ${selected ? 'text-zinc-100' : 'text-zinc-200'}`}>
                  {m.displayName}
                </span>
                <span className="leading-normal text-[11px] truncate text-zinc-400/80">
                  {m.description}
                </span>
              </span>
              {selected && (
                <CheckIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 flex-shrink-0 text-zinc-300" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
