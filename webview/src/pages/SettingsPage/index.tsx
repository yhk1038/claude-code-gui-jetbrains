import { useRouter, Route } from '@/router';
import { ROUTE_META } from '@/router/routes';
import { useStaticDocumentTitle } from '@/hooks';
import { SettingsLayout } from './SettingsLayout';
import { GeneralSettings } from './General';
import { AppearanceSettings } from './Appearance';
import { PermissionsSettings } from './Permissions';
import { CliSettings } from './Cli';
import { AdvancedSettings } from './Advanced';
import { TunnelSettings } from './Tunnel';
import { AboutSettings } from './About';
import { UsageSettings } from './Usage';
import { ReleasesSettings } from './Releases';
import { AccountSettings } from './Account';
import { BrowserSettings } from './Browser';
import { PrivacySettings } from './Privacy';

/**
 * Settings 메인 컴포넌트 - 현재 라우트에 따라 적절한 설정 페이지 렌더링
 */
export function SettingsPage() {
  const { route } = useRouter();

  // Report a stable tab label to the IDE. Without this the JetBrains editor tab
  // falls back to the raw URL (e.g. "localhost:PORT/settings...") because the
  // settings screen never sets document.title.
  useStaticDocumentTitle(ROUTE_META[Route.SETTINGS].label);

  const renderContent = () => {
    switch (route) {
      case Route.SETTINGS_GENERAL:
        return <GeneralSettings />;
      case Route.SETTINGS_APPEARANCE:
        return <AppearanceSettings />;
      case Route.SETTINGS_PERMISSIONS:
        return <PermissionsSettings />;
      case Route.SETTINGS_PRIVACY:
        return <PrivacySettings />;
      case Route.SETTINGS_CLI:
        return <CliSettings />;
      case Route.SETTINGS_ADVANCED:
        return <AdvancedSettings />;
      case Route.SETTINGS_TUNNEL:
        return <TunnelSettings />;
      case Route.SETTINGS_BROWSER:
        return <BrowserSettings />;
      case Route.SETTINGS_ACCOUNT:
        return <AccountSettings />;
      case Route.SETTINGS_ABOUT:
        return <AboutSettings />;
      case Route.SETTINGS_USAGE:
        return <UsageSettings />;
      case Route.SETTINGS_RELEASES:
        return <ReleasesSettings />;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <SettingsLayout>
      {renderContent()}
    </SettingsLayout>
  );
}

export { SettingsOverlay } from './SettingsOverlay';
