import { SettingSection } from '../common';
import { ROUTE_META, Route } from '@/router/routes';
import { useAccountData } from '@/components/AccountUsageModal/useAccountData';
import { InfoRow, InfoRowSkeleton } from '@/components/AccountUsageModal/InfoRow';

export function AccountSettings() {
  const meta = ROUTE_META[Route.SETTINGS_ACCOUNT];
  const { data: accountData, isLoading: accountLoading } = useAccountData();

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-6">{meta.label}</h2>

      <SettingSection title="Profile">
        {accountLoading && !accountData ? (
          <>
            <InfoRowSkeleton />
            <InfoRowSkeleton />
            <InfoRowSkeleton />
          </>
        ) : (
          <div className="py-3">
            <InfoRow label="Auth method" value={accountData?.authMethod ?? null} />
            <InfoRow label="Email" value={accountData?.email ?? null} />
            <InfoRow label="Plan" value={accountData?.plan ?? null} />
          </div>
        )}
      </SettingSection>
    </div>
  );
}
