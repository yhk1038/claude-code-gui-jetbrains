import { useEffect } from 'react';
import { StaticItem } from '../../types';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';
import { useChatStreamContext } from '@/contexts/ChatStreamContext';
import { useCliConfig } from '@/contexts/CliConfigContext';
import { toModelAlias } from '@/types/models';
import type { ModelInfo } from '@/types/slashCommand';
import { ToggleSwitch } from '@/components/ToggleSwitch';

export const FAST_MODE_TOGGLE_EVENT = 'fast-mode-toggle';

function resolveActiveModel(
  models: ModelInfo[],
  sessionModel: string | null,
  settingsModel: string | null,
): ModelInfo | null {
  const alias = sessionModel ?? (settingsModel ? toModelAlias(settingsModel) : 'default');
  return models.find((m) => m.value === alias) ?? null;
}

// disabled를 런타임에 동적으로 변경할 수 있도록 backing field + getter/setter 설정
let _disabled = false;
const _toggleFastModeItem = new StaticItem('toggle-fast-mode', 'Toggle fast mode', {
  disabled: false,
  keepOpen: true,
  valueComponent: () => <FastModeToggle />,
  action: async () => {
    window.dispatchEvent(new CustomEvent(FAST_MODE_TOGGLE_EVENT));
  },
});
Object.defineProperty(_toggleFastModeItem, 'disabled', {
  get: () => _disabled,
  set: (v: boolean) => { _disabled = v; },
  enumerable: true,
  configurable: true,
});
export const toggleFastModeItem = _toggleFastModeItem;

const FastModeToggle = () => {
  const { settings, updateSetting } = useClaudeSettings();
  const { sessionModel } = useChatStreamContext();
  const { controlResponse } = useCliConfig();
  const models: ModelInfo[] = controlResponse?.response?.response?.models ?? [];
  const activeModel = resolveActiveModel(models, sessionModel, settings.model);
  const supportsFastMode = activeModel?.supportsFastMode ?? false;
  const enabled = settings.preferFastMode ?? false;

  // 행(row) disabled 상태를 supportsFastMode에 따라 동적으로 갱신
  (toggleFastModeItem as unknown as { disabled: boolean }).disabled = !supportsFastMode;

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
