import { useState, useEffect } from 'react';
import { SettingSection, SettingRow, ScopeGuard } from '../common';
import { Select, type SelectOption } from '@/components/Select';
import { useSettings } from '@/contexts/SettingsContext';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';
import { useBridge } from '@/hooks/useBridge';
import { SettingKey } from '@/types/settings';
import { ROUTE_META, Route } from '@/router/routes';
import { isJetBrains } from '@/config/environment';
import { useCliConfig } from '@/contexts/CliConfigContext';
import { DEFAULT_MODEL_ALIAS, toModelAlias } from '@/types/models';

interface TerminalInfo {
  id: string;
  label: string;
  isDefault: boolean;
}

const CUSTOM_MARKER = '__custom__';

function toSelectValue(app: string | null, terminals: TerminalInfo[]): string {
  if (app === null) return '';
  if (terminals.some((t) => t.label === app)) return app;
  return CUSTOM_MARKER;
}

export function CliSettings() {
  const { settings, updateSetting, scope } = useSettings();
  const meta = ROUTE_META[Route.SETTINGS_CLI];
  const { send } = useBridge();
  const isJetBrainsEnv = isJetBrains();
  const { settings: claudeSettings, updateSetting: updateClaudeSetting } = useClaudeSettings();
  const { controlResponse } = useCliConfig();
  const availableModels = controlResponse?.response?.response?.models ?? [];

  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [detectedCliPath, setDetectedCliPath] = useState<string | null>(null);
  const [detectedNodePath, setDetectedNodePath] = useState<string | null>(null);

  useEffect(() => {
    send('GET_AVAILABLE_TERMINALS', {})
      .then((res) => {
        setTerminals((res?.terminals as TerminalInfo[]) ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [send]);

  useEffect(() => {
    send('GET_DETECTED_CLI_PATH', {})
      .then((res) => {
        setDetectedCliPath((res?.path as string | null) ?? null);
      })
      .catch(() => setDetectedCliPath(null));
  }, [send]);

  useEffect(() => {
    send('GET_DETECTED_NODE_PATH', {})
      .then((res) => {
        setDetectedNodePath((res?.path as string | null) ?? null);
      })
      .catch(() => setDetectedNodePath(null));
  }, [send]);

  const terminalApp = settings[SettingKey.TERMINAL_APP];
  const selectValue = toSelectValue(terminalApp, terminals);
  const [customInput, setCustomInput] = useState(
    selectValue === CUSTOM_MARKER ? (terminalApp ?? '') : '',
  );

  const handleSelectChange = (value: string) => {
    if (value === CUSTOM_MARKER) {
      void updateSetting(SettingKey.TERMINAL_APP, customInput || null);
    } else {
      void updateSetting(SettingKey.TERMINAL_APP, value || null);
    }
  };

  const handleCustomInput = (value: string) => {
    setCustomInput(value);
    void updateSetting(SettingKey.TERMINAL_APP, value || null);
  };

  const terminalOptions: SelectOption[] = [
    { value: '', label: 'System Default' },
    ...terminals.map((t) => ({
      value: t.label,
      label: t.isDefault ? `${t.label} (Default)` : t.label,
    })),
    { value: CUSTOM_MARKER, label: 'Custom...' },
  ];

  const modelOptions: SelectOption[] =
    availableModels.length === 0
      ? [{ value: '', label: 'Default (recommended)' }]
      : availableModels.map((m) => ({
          value: m.value === DEFAULT_MODEL_ALIAS ? '' : m.value,
          label: m.displayName,
        }));

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-6">{meta.label}</h2>

      <ScopeGuard supportedScope="global" currentScope={scope}>
        <SettingSection title="Terminal">
          <SettingRow
            label="Terminal App"
            description={
              isJetBrainsEnv
                ? 'JetBrains IDE built-in terminal is always used.'
                : "Terminal application used when running 'Open Claude in Terminal'"
            }
          >
            {isJetBrainsEnv ? (
              <span className="text-sm text-text-tertiary">JetBrains built-in terminal</span>
            ) : loading ? (
              <span className="text-sm text-text-tertiary">Detecting terminals...</span>
            ) : (
              <div className="flex items-center gap-2">
                <Select
                  value={selectValue}
                  options={terminalOptions}
                  ariaLabel="Terminal App"
                  onChange={handleSelectChange}
                  className="bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary"
                />
                {selectValue === CUSTOM_MARKER && (
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => handleCustomInput(e.target.value)}
                    placeholder="e.g., Kitty"
                    className="w-40 bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder-text-tertiary"
                  />
                )}
              </div>
            )}
          </SettingRow>
        </SettingSection>
      </ScopeGuard>

      <SettingSection title="Model">
        <SettingRow
          label="Default Model"
          description="Default model for new sessions"
        >
          <Select
            value={claudeSettings.model ? toModelAlias(claudeSettings.model) : ''}
            options={modelOptions}
            ariaLabel="Default Model"
            onChange={(value) => void updateClaudeSetting('model', value || null)}
            className="bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary"
          />
        </SettingRow>
      </SettingSection>

      <ScopeGuard supportedScope="global" currentScope={scope}>
        <SettingSection title="Claude CLI">
          <SettingRow
            label="CLI Path"
            description="Path to Claude CLI executable (leave empty for auto-detect)"
          >
            <div className="flex flex-col items-end gap-1">
              <input
                type="text"
                value={settings[SettingKey.CLI_PATH] || ''}
                onChange={(e) => updateSetting(SettingKey.CLI_PATH, e.target.value || null)}
                placeholder="Auto-detect"
                className="w-64 bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder-text-tertiary"
              />
              {detectedCliPath && !settings[SettingKey.CLI_PATH] && (
                <span className="text-xs text-text-tertiary truncate max-w-64" title={detectedCliPath}>
                  {detectedCliPath}
                </span>
              )}
            </div>
          </SettingRow>
        </SettingSection>

        <SettingSection title="Node.js">
          <SettingRow
            label="Node Path"
            description="Path to Node.js executable that runs the backend (leave empty for auto-detect). Takes effect after restart."
          >
            <div className="flex flex-col items-end gap-1">
              <input
                type="text"
                value={settings[SettingKey.NODE_PATH] || ''}
                onChange={(e) => updateSetting(SettingKey.NODE_PATH, e.target.value || null)}
                placeholder="Auto-detect"
                className="w-64 bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder-text-tertiary"
              />
              {detectedNodePath && !settings[SettingKey.NODE_PATH] && (
                <span className="text-xs text-text-tertiary truncate max-w-64" title={detectedNodePath}>
                  {detectedNodePath}
                </span>
              )}
            </div>
          </SettingRow>
        </SettingSection>
      </ScopeGuard>
    </div>
  );
}
