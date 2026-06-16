import { SettingSection, SettingRow } from '../common';
import { Select, type SelectOption } from '@/components/Select';
import { HostModeSection } from './HostModeSection';
import { useSettings } from '@/contexts/SettingsContext';
import { SettingKey, ThemeMode } from '@/types/settings';
import { ROUTE_META, Route } from '@/router/routes';
import { isJetBrains } from '@/config/environment';
import {
  AUTO_SCROLL_THRESHOLD_DEFAULT,
  AUTO_SCROLL_THRESHOLD_MIN,
  AUTO_SCROLL_THRESHOLD_MAX,
  clampAutoScrollThreshold,
} from '@/utils/autoScroll';

const NOT_SET_VALUE = '__NOT_SET__';

export function AppearanceSettings() {
  const { scopeSettings, updateSetting, scope, resetToGlobal } = useSettings();
  const meta = ROUTE_META[Route.SETTINGS_APPEARANCE];

  const rawTheme = scopeSettings[SettingKey.THEME] as ThemeMode | undefined;
  const isThemeNotSet = rawTheme === undefined && scope === 'project';
  const themeValue = isThemeNotSet ? NOT_SET_VALUE : (rawTheme ?? ThemeMode.SYSTEM);

  const rawFontSize = scopeSettings[SettingKey.FONT_SIZE] as number | undefined;
  const isFontSizeNotSet = rawFontSize === undefined && scope === 'project';

  const rawAutoScrollThreshold = scopeSettings[SettingKey.AUTO_SCROLL_THRESHOLD] as number | undefined;
  const isAutoScrollThresholdNotSet = rawAutoScrollThreshold === undefined && scope === 'project';

  const themeOptions: SelectOption[] = [
    ...(scope === 'project'
      ? [{ value: NOT_SET_VALUE, label: 'Not set (use global)', italic: true }]
      : []),
    { value: ThemeMode.SYSTEM, label: isJetBrains() ? 'System (IDE)' : 'System (OS)' },
    { value: ThemeMode.LIGHT, label: 'Light' },
    { value: ThemeMode.DARK, label: 'Dark' },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-6">
        {meta.label}
      </h2>

      <SettingSection title="Theme">
        <SettingRow
          label="Color Theme"
          description="Choose the color theme for the interface"
        >
          <Select
            value={themeValue}
            options={themeOptions}
            ariaLabel="Color Theme"
            onChange={(value) => {
              if (value === NOT_SET_VALUE) {
                resetToGlobal(SettingKey.THEME);
                return;
              }
              updateSetting(SettingKey.THEME, value as ThemeMode);
            }}
            className={`bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm ${
              isThemeNotSet ? 'text-text-tertiary' : 'text-text-primary'
            }`}
          />
        </SettingRow>

        <SettingRow
          label="Font Size"
          description="Base font size for the interface"
        >
          <input
            type="number"
            min="8"
            max="32"
            value={isFontSizeNotSet ? '' : (rawFontSize ?? 13)}
            placeholder={isFontSizeNotSet ? 'Not set' : undefined}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '') {
                if (scope === 'project') {
                  resetToGlobal(SettingKey.FONT_SIZE);
                }
                return;
              }
              updateSetting(SettingKey.FONT_SIZE, parseInt(value, 10));
            }}
            className={`w-20 bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm ${
              isFontSizeNotSet ? 'text-text-tertiary italic' : 'text-text-primary'
            }`}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Scrolling">
        <SettingRow
          label="Auto-scroll resume distance"
          description={`Scrolling up always pauses auto-scroll so you can read freely. It resumes once you scroll back within this many pixels of the bottom. Smaller means you must return closer to re-engage. Default ${AUTO_SCROLL_THRESHOLD_DEFAULT}.`}
        >
          <input
            type="number"
            min={AUTO_SCROLL_THRESHOLD_MIN}
            max={AUTO_SCROLL_THRESHOLD_MAX}
            step="1"
            value={isAutoScrollThresholdNotSet ? '' : (rawAutoScrollThreshold ?? AUTO_SCROLL_THRESHOLD_DEFAULT)}
            placeholder={isAutoScrollThresholdNotSet ? 'Not set' : undefined}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '') {
                if (scope === 'project') {
                  resetToGlobal(SettingKey.AUTO_SCROLL_THRESHOLD);
                }
                return;
              }
              const parsed = parseInt(value, 10);
              if (!Number.isInteger(parsed)) return;
              updateSetting(SettingKey.AUTO_SCROLL_THRESHOLD, clampAutoScrollThreshold(parsed));
            }}
            className={`w-24 bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm ${
              isAutoScrollThresholdNotSet ? 'text-text-tertiary italic' : 'text-text-primary'
            }`}
          />
        </SettingRow>
      </SettingSection>

      <HostModeSection />
    </div>
  );
}
