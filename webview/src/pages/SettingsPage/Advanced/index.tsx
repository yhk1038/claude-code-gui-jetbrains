import { SettingSection, SettingRow } from '../common';
import { Select, type SelectOption } from '@/components/Select';
import { useSettings } from '@/contexts/SettingsContext';
import { SettingKey, LogLevel } from '@/types/settings';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { ROUTE_META, Route } from '@/router/routes';

const NOT_SET_VALUE = '__NOT_SET__';

export function AdvancedSettings() {
  const { scopeSettings, updateSetting, scope, resetToGlobal } = useSettings();
  const meta = ROUTE_META[Route.SETTINGS_ADVANCED];

  const rawDebugMode = scopeSettings[SettingKey.DEBUG_MODE] as boolean | undefined;
  const isDebugNotSet = rawDebugMode === undefined && scope === 'project';

  const rawLogLevel = scopeSettings[SettingKey.LOG_LEVEL] as LogLevel | undefined;
  const isLogLevelNotSet = rawLogLevel === undefined && scope === 'project';
  const logLevelValue = isLogLevelNotSet ? NOT_SET_VALUE : (rawLogLevel ?? LogLevel.INFO);

  const logLevelOptions: SelectOption[] = [
    ...(scope === 'project'
      ? [{ value: NOT_SET_VALUE, label: 'Not set (use global)', italic: true }]
      : []),
    { value: LogLevel.DEBUG, label: 'Debug' },
    { value: LogLevel.INFO, label: 'Info' },
    { value: LogLevel.WARN, label: 'Warning' },
    { value: LogLevel.ERROR, label: 'Error' },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-6">{meta.label}</h2>

      <SettingSection title="Debugging">
        <SettingRow
          label="Debug Mode"
          description="Enable debug logging and diagnostics"
        >
          {isDebugNotSet ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-tertiary italic">Not set (use global)</span>
              <ToggleSwitch
                checked={false}
                onChange={(checked) => updateSetting(SettingKey.DEBUG_MODE, checked)}
                disabled={false}
              />
            </div>
          ) : (
            <ToggleSwitch
              checked={rawDebugMode ?? false}
              onChange={(checked) => updateSetting(SettingKey.DEBUG_MODE, checked)}
            />
          )}
        </SettingRow>

        <SettingRow
          label="Log Level"
          description="Minimum log level to display"
        >
          <Select
            value={logLevelValue}
            options={logLevelOptions}
            ariaLabel="Log Level"
            onChange={(value) => {
              if (value === NOT_SET_VALUE) {
                resetToGlobal(SettingKey.LOG_LEVEL);
                return;
              }
              updateSetting(SettingKey.LOG_LEVEL, value as LogLevel);
            }}
            className={`bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm ${
              isLogLevelNotSet ? 'text-text-tertiary' : 'text-text-primary'
            }`}
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
}
