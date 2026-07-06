import { SettingSection, SettingRow } from '../common';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { useTelemetryConsent, ConsentStatus, ConsentSource } from '@/hooks/useTelemetryConsent';
import { PRIVACY_POLICY_URL } from '@/config/app';
import { useTranslation } from '@/i18n';

export function PrivacySettings() {
  const { t } = useTranslation('settings');
  const {
    status: telemetryStatus,
    accept: acceptTelemetry,
    deny: denyTelemetry,
  } = useTelemetryConsent();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text-primary">{t('privacy.title')}</h2>
        <a
          href={PRIVACY_POLICY_URL}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-text-link hover:underline"
        >
          {t('privacy.privacyPolicyLink')}
        </a>
      </div>

      <SettingSection title={t('privacy.telemetry.sectionTitle')}>
        <SettingRow
          label={t('privacy.telemetry.sendUsageStatistics.label')}
          description={t('privacy.telemetry.sendUsageStatistics.description')}
        >
          <ToggleSwitch
            checked={telemetryStatus === ConsentStatus.ACCEPTED}
            onChange={(checked) => {
              if (checked) {
                void acceptTelemetry(ConsentSource.SETTINGS);
              } else {
                void denyTelemetry(ConsentSource.SETTINGS);
              }
            }}
            ariaLabel={t('privacy.telemetry.sendUsageStatistics.label')}
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
}
