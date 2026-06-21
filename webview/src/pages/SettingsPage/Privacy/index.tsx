import { SettingSection, SettingRow } from '../common';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { ROUTE_META, Route } from '@/router/routes';
import { useTelemetryConsent, ConsentStatus, ConsentSource } from '@/hooks/useTelemetryConsent';
import { PRIVACY_POLICY_URL } from '@/config/app';

export function PrivacySettings() {
  const meta = ROUTE_META[Route.SETTINGS_PRIVACY];
  const {
    status: telemetryStatus,
    accept: acceptTelemetry,
    deny: denyTelemetry,
  } = useTelemetryConsent();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text-primary">{meta.label}</h2>
        <a
          href={PRIVACY_POLICY_URL}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-text-link hover:underline"
        >
          Privacy Policy
        </a>
      </div>

      <SettingSection title="Telemetry">
        <SettingRow
          label="Send usage statistics"
          description="Sends usage statistics that do not directly identify you, to help improve the product. Source code and personal data are never sent. You can turn this off anytime."
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
            ariaLabel="Send usage statistics"
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
}
