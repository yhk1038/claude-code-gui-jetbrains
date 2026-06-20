import { SettingSection, SettingRow } from '../common';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { ROUTE_META, Route } from '@/router/routes';
import { useTelemetryConsent, ConsentStatus, ConsentSource } from '@/hooks/useTelemetryConsent';

export function PrivacySettings() {
  const meta = ROUTE_META[Route.SETTINGS_PRIVACY];
  const {
    status: telemetryStatus,
    accept: acceptTelemetry,
    deny: denyTelemetry,
  } = useTelemetryConsent();

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-6">{meta.label}</h2>

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
