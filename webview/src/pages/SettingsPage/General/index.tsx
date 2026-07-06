import { SettingSection, SettingRow } from '../common';
import { Select, type SelectOption } from '@/components/Select';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { HostModeRow } from './HostModeRow';
import { OpenSettingsRow } from './OpenSettingsRow';
import { ChatPaginationRow } from './ChatPaginationRow';
import { ClaudeConfigDirRow } from './ClaudeConfigDirRow';
import { APP_NAME } from '@/config/app';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';
import { useTranslation } from '@/i18n';

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
  const { t } = useTranslation('settings');
  const { scopeSettings, updateSetting, scope, resetToGlobal } = useClaudeSettings();

  // Claude's response language is a free-text field in Claude's settings.json.
  // Show the value stored at the current scope (empty → English placeholder);
  // clearing the input removes the key at this scope (never overwrites on upgrade).
  const responseLanguage = (scopeSettings.language as string | undefined) ?? '';

  const rawUiLanguage = scopeSettings.uiLanguage as string | undefined;
  const isUiNotSet = rawUiLanguage === undefined && scope === 'project';
  // Interface language defaults to English when unset (does not follow the response language).
  const currentUiLanguage = isUiNotSet ? NOT_SET_VALUE : ((rawUiLanguage as string) ?? 'english');

  const useCtrlEnterToSend = (scopeSettings.useCtrlEnterToSend as boolean | undefined) ?? false;
  const focusInputOnEditorContext = (scopeSettings.focusInputOnEditorContext as boolean | undefined) ?? true;
  const respectGitignoreForContext = (scopeSettings.respectGitignoreForContext as boolean | undefined) ?? false;

  const languageOptions: SelectOption[] = [
    ...(scope === 'project'
      ? [{ value: NOT_SET_VALUE, label: t('general.language.notSet'), italic: true }]
      : []),
    ...LANGUAGE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-6">{t('nav.general')}</h2>

      <SettingSection title={APP_NAME}>
        <SettingRow
          label={t('general.language.label')}
          description={t('general.language.description')}
        >
          <input
            type="text"
            value={responseLanguage}
            onChange={(e) => updateSetting('language', e.target.value || null)}
            placeholder={t('general.language.placeholder')}
            aria-label={t('general.language.label')}
            className="w-48 bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder-text-tertiary"
          />
        </SettingRow>

        <SettingRow
          label={t('general.uiLanguage.label')}
          description={t('general.uiLanguage.description')}
        >
          <Select
            value={currentUiLanguage}
            options={languageOptions}
            ariaLabel={t('general.uiLanguage.label')}
            className={`bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm ${
              isUiNotSet ? 'text-text-tertiary' : 'text-text-primary'
            }`}
            onChange={(value) => {
              if (value === NOT_SET_VALUE) {
                resetToGlobal('uiLanguage');
                return;
              }
              updateSetting('uiLanguage', value);
            }}
          />
        </SettingRow>

        <SettingRow
          label={t('general.useCtrlEnterToSend.label')}
          description={t('general.useCtrlEnterToSend.description')}
        >
          <ToggleSwitch
            checked={useCtrlEnterToSend}
            onChange={(checked) => updateSetting('useCtrlEnterToSend', checked)}
            ariaLabel={t('general.useCtrlEnterToSend.label')}
          />
        </SettingRow>

        <SettingRow
          label={t('general.focusInputOnEditorContext.label')}
          description={t('general.focusInputOnEditorContext.description')}
        >
          <ToggleSwitch
            checked={focusInputOnEditorContext}
            onChange={(checked) => updateSetting('focusInputOnEditorContext', checked)}
            ariaLabel={t('general.focusInputOnEditorContext.label')}
          />
        </SettingRow>

        <SettingRow
          label={t('general.respectGitignoreForContext.label')}
          description={t('general.respectGitignoreForContext.description')}
        >
          <ToggleSwitch
            checked={respectGitignoreForContext}
            onChange={(checked) => updateSetting('respectGitignoreForContext', checked)}
            ariaLabel={t('general.respectGitignoreForContext.label')}
          />
        </SettingRow>

        <HostModeRow />

        <OpenSettingsRow />

        <ChatPaginationRow />

        <ClaudeConfigDirRow />
      </SettingSection>
    </div>
  );
}
