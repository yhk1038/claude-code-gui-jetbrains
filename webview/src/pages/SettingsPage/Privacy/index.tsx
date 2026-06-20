import { SettingSection, SettingRow } from '../common';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { ROUTE_META, Route } from '@/router/routes';
import { useTelemetryConsent, ConsentStatus } from '@/hooks/useTelemetryConsent';

export function PrivacySettings() {
  const meta = ROUTE_META[Route.SETTINGS_PRIVACY];
  const {
    status: telemetryStatus,
    accept: acceptTelemetry,
    decline: declineTelemetry,
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
