import { useEffect } from 'react';
import { StaticItem } from '../../types';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';
import { useChatStreamContext } from '@/contexts/ChatStreamContext';
import { useCliConfig } from '@/contexts/CliConfigContext';
import { resolveModelInfo } from '@/types/models';
import type { ModelInfo } from '@/types/slashCommand';
import { ToggleSwitch } from '@/components/ToggleSwitch';

export const FAST_MODE_TOGGLE_EVENT = 'fast-mode-toggle';

/** Reason shown as a hover tooltip when the row is disabled (model doesn't support fast mode). */
export const FAST_MODE_UNSUPPORTED_REASON = 'Fast mode is only available on Opus models';

function resolveActiveModel(
  models: ModelInfo[],
  sessionModel: string | null,
  settingsModel: string | null,
): ModelInfo | null {
  return resolveModelInfo(models, sessionModel ?? settingsModel);
}

// Actual disabled state is injected by CommandPaletteProvider (via
// applyModelCapabilityFlags) based on the current model's capability, not
// mutated here. Mutating module-level state from a render function is a
// React anti-pattern that caused stale/flickering disabled state (see
// applyModelCapabilityFlags for the source of truth).
export const toggleFastModeItem = new StaticItem('toggle-fast-mode', 'Toggle fast mode', {
  disabled: false,
  keepOpen: true,
  valueComponent: () => <FastModeToggle />,
  action: async () => {
    window.dispatchEvent(new CustomEvent(FAST_MODE_TOGGLE_EVENT));
  },
});

const FastModeToggle = () => {
  const { settings, updateSetting } = useClaudeSettings();
  const { sessionModel } = useChatStreamContext();
  const { controlResponse } = useCliConfig();
  const models: ModelInfo[] = controlResponse?.response?.response?.models ?? [];
  const activeModel = resolveActiveModel(models, sessionModel, settings.model);
  const supportsFastMode = activeModel?.supportsFastMode ?? false;
  const enabled = settings.preferFastMode ?? false;

  // 행(row) 클릭 시 발생하는 이벤트 처리 (지원되는 모델일 때만 토글)
  useEffect(() => {
    const handler = () => {
      if (!supportsFastMode) return;
      void updateSetting('preferFastMode', !enabled);
    };
    window.addEventListener(FAST_MODE_TOGGLE_EVENT, handler);
    return () => window.removeEventListener(FAST_MODE_TOGGLE_EVENT, handler);
  }, [supportsFastMode, enabled, updateSetting]);

  return (
    <ToggleSwitch
      checked={enabled}
      onChange={(value) => void updateSetting('preferFastMode', value)}
      disabled={!supportsFastMode}
      size="small"
    />
  );
};
