import { useState, useEffect } from 'react';
import { SettingSection, SettingRow, ScopeGuard } from '../common';
import { useSettings } from '@/contexts/SettingsContext';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';
import { useBridge } from '@/hooks/useBridge';
import { SettingKey } from '@/types/settings';
import { ROUTE_META, Route } from '@/router/routes';
import { isJetBrains } from '@/config/environment';
import { useCliConfig } from '@/contexts/CliConfigContext';
import { toModelAlias } from '@/types/models';

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

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-6">{meta.label}</h2>

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
              <span className="text-sm text-zinc-500">JetBrains built-in terminal</span>
            ) : loading ? (
              <span className="text-sm text-zinc-500">Detecting terminals...</span>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={selectValue}
                  onChange={(e) => handleSelectChange(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100"
                >
                  <option value="">System Default</option>
                  {terminals.map((t) => (
                    <option key={t.id} value={t.label}>
                      {t.isDefault ? `${t.label} (Default)` : t.label}
                    </option>
                  ))}
                  <option value={CUSTOM_MARKER}>Custom...</option>
                </select>
                {selectValue === CUSTOM_MARKER && (
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => handleCustomInput(e.target.value)}
                    placeholder="e.g., Kitty"
                    className="w-40 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500"
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
          <select
            value={claudeSettings.model ? toModelAlias(claudeSettings.model) : ''}
            onChange={(e) => void updateClaudeSetting('model', e.target.value || null)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100"
          >
            {availableModels.length === 0 ? (
              <option value="">Default (recommended)</option>
            ) : availableModels.map((m) => (
              <option key={m.value} value={m.value}>
                {m.displayName}
              </option>
            ))}
          </select>
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
                className="w-64 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500"
              />
              {detectedCliPath && !settings[SettingKey.CLI_PATH] && (
                <span className="text-xs text-zinc-500 truncate max-w-64" title={detectedCliPath}>
                  {detectedCliPath}
                </span>
              )}
            </div>
          </SettingRow>
        </SettingSection>
      </ScopeGuard>
    </div>
  );
}
