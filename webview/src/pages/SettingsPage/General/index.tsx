import { SettingSection, SettingRow } from '../common';
import { Select, type SelectOption } from '@/components/Select';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { HostModeRow } from './HostModeRow';
import { APP_NAME } from '@/config/app';
import { ROUTE_META, Route } from '@/router/routes';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';
import { useTelemetryConsent, ConsentStatus } from '@/hooks/useTelemetryConsent';

const NOT_SET_VALUE = '__NOT_SET__';

const LANGUAGE_OPTIONS = [
  { value: 'english', label: 'English' },
  { value: 'korean', label: 'Korean (한국어)' },
  { value: 'japanese', label: 'Japanese (日本語)' },
  { value: 'chinese', label: 'Chinese (中文)' },
  { value: 'spanish', label: 'Spanish (Español)' },
  { value: 'french', label: 'French (Français)' },
  { value: 'german', label: 'German (Deutsch)' },
  { value: 'portuguese', label: 'Portuguese (Português)' },
  { value: 'russian', label: 'Russian (Русский)' },
] as const;

export function GeneralSettings() {
  const meta = ROUTE_META[Route.SETTINGS_GENERAL];
  const { scopeSettings, updateSetting, scope, resetToGlobal } = useClaudeSettings();
  const { status: telemetryStatus, accept: acceptTelemetry, decline: declineTelemetry } = useTelemetryConsent();

  const rawLanguage = scopeSettings.language as string | undefined;
  const isNotSet = rawLanguage === undefined && scope === 'project';
  const currentLanguage = isNotSet ? NOT_SET_VALUE : ((rawLanguage as string) ?? '');

  const useCtrlEnterToSend = (scopeSettings.useCtrlEnterToSend as boolean | undefined) ?? false;
  const focusInputOnEditorContext = (scopeSettings.focusInputOnEditorContext as boolean | undefined) ?? true;

  const languageOptions: SelectOption[] = [
    ...(scope === 'project'
      ? [{ value: NOT_SET_VALUE, label: 'Not set (use global)', italic: true }]
      : []),
    ...LANGUAGE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-6">{meta.label}</h2>

      <SettingSection title={APP_NAME}>
        <SettingRow
          label="Language"
          description="Claude's preferred response language"
        >
          <Select
            value={currentLanguage}
            options={languageOptions}
            ariaLabel="Language"
            className={`bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm ${
              isNotSet ? 'text-text-tertiary' : 'text-text-primary'
            }`}
            onChange={(value) => {
              if (value === NOT_SET_VALUE) {
                resetToGlobal('language');
                return;
              }
              updateSetting('language', value);
            }}
          />
        </SettingRow>

        <SettingRow
          label="Use Ctrl Enter To Send"
          description="When enabled, use Ctrl/Cmd+Enter to send prompts instead of just Enter. This allows Enter to create new lines."
        >
          <ToggleSwitch
            checked={useCtrlEnterToSend}
            onChange={(checked) => updateSetting('useCtrlEnterToSend', checked)}
            ariaLabel="Use Ctrl Enter To Send"
          />
        </SettingRow>

        <SettingRow
          label="Focus chat input after attaching file path"
          description="When you press Alt+K in the editor, move focus to the chat input after inserting the file path."
        >
          <ToggleSwitch
            checked={focusInputOnEditorContext}
            onChange={(checked) => updateSetting('focusInputOnEditorContext', checked)}
            ariaLabel="Focus chat input after attaching file path"
          />
        </SettingRow>

        <HostModeRow />
      </SettingSection>

      <SettingSection title="Privacy">
        <SettingRow
          label="Send usage statistics"
          description="Sends usage statistics that do not directly identify you, to help improve the product. You can turn this off anytime."
        >
          <ToggleSwitch
            checked={telemetryStatus === ConsentStatus.GRANTED}
            onChange={(checked) => {
              if (checked) {
                void acceptTelemetry();
              } else {
                void declineTelemetry();
              }
            }}
            ariaLabel="Send usage statistics"
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
}
