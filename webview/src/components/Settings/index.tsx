import { useRouter, Route } from '@/router';
import { SettingsLayout } from './SettingsLayout';
import { GeneralSettings } from './General';
import { AppearanceSettings } from './Appearance';
import { PermissionsSettings } from './Permissions';
import { CliSettings } from './Cli';
import { AdvancedSettings } from './Advanced';
import { AboutSettings } from './About';

/**
 * Settings 메인 컴포넌트 - 현재 라우트에 따라 적절한 설정 페이지 렌더링
 */
export function Settings() {
  const { route } = useRouter();

  const renderContent = () => {
    switch (route) {
      case Route.SETTINGS_GENERAL:
        return <GeneralSettings />;
      case Route.SETTINGS_APPEARANCE:
        return <AppearanceSettings />;
      case Route.SETTINGS_PERMISSIONS:
        return <PermissionsSettings />;
      case Route.SETTINGS_CLI:
        return <CliSettings />;
      case Route.SETTINGS_ADVANCED:
        return <AdvancedSettings />;
      case Route.SETTINGS_ABOUT:
        return <AboutSettings />;
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
