import { SettingSection, SettingRow } from '../common';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { useTelemetryConsent, ConsentStatus, ConsentSource } from '@/hooks/useTelemetryConsent';
import { useAnnouncementsEnabled } from '@/hooks/useAnnouncementsEnabled';
import { useConfirmDialog } from '@/components/ConfirmDialog/useConfirmDialog';
import { PRIVACY_POLICY_URL } from '@/config/app';
import { useTranslation } from '@/i18n';

export function PrivacySettings() {
  const { t } = useTranslation('settings');
  const {
    status: telemetryStatus,
    accept: acceptTelemetry,
    deny: denyTelemetry,
  } = useTelemetryConsent();
  const { enabled: announcementsEnabled, setEnabled: setAnnouncementsEnabled } =
    useAnnouncementsEnabled();
  const { confirmDialog, confirm } = useConfirmDialog();

  // Turning ON needs no confirmation; turning OFF warns that important messages
  // (urgent patches, required updates) would stop arriving too, and only proceeds
  // to off if the user confirms. Cancelling leaves the toggle on.
  const handleAnnouncementsToggle = async (checked: boolean) => {
    if (checked) {
      await setAnnouncementsEnabled(true);
      return;
    }
    const ok = await confirm({
      title: t('privacy.telemetry.receiveAnnouncements.confirmTitle'),
      message: t('privacy.telemetry.receiveAnnouncements.confirmMessage'),
    });
    if (!ok) return;
    await setAnnouncementsEnabled(false);
  };

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
        <SettingRow
          label={t('privacy.telemetry.receiveAnnouncements.label')}
          description={t('privacy.telemetry.receiveAnnouncements.description')}
        >
          <ToggleSwitch
            checked={announcementsEnabled ?? true}
            onChange={(checked) => void handleAnnouncementsToggle(checked)}
            ariaLabel={t('privacy.telemetry.receiveAnnouncements.label')}
          />
        </SettingRow>
      </SettingSection>
      {confirmDialog}
    </div>
  );
}
