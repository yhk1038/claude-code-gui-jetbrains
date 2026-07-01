import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { SettingSection, SettingRow } from '../common';
import { APP_NAME } from '@/config/app';
import { ROUTE_META, Route } from '@/router/routes';
import { useVersionInfo } from '@/hooks/useVersionInfo';
import { CliUpdateControl } from './CliUpdateControl';

export function AboutSettings() {
  const meta = ROUTE_META[Route.SETTINGS_ABOUT];
  const { pluginVersion, cliVersion, refresh, isLoading } = useVersionInfo();

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-6">{meta.label}</h2>

      <SettingSection title="Version Information">
        <SettingRow label="Plugin Version">
          <span className="text-sm text-text-secondary">{pluginVersion}</span>
        </SettingRow>

        <SettingRow label={`${APP_NAME} Version`}>
          <div className="flex items-center gap-2">
            <CliUpdateControl />
            <span className="text-sm text-text-secondary">{cliVersion ?? 'not detected'}</span>
            <button
              onClick={refresh}
              disabled={isLoading}
              aria-label="Refresh version"
              title="Refresh"
              className="text-text-tertiary hover:text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </SettingRow>
      </SettingSection>

      <SettingSection title="Links">
        <SettingRow label="Documentation">
          <a
            href="https://github.com/yhk1038/claude-code-gui-jetbrains"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-text-link hover:text-text-link hover:underline"
          >
            View on GitHub
          </a>
        </SettingRow>

        <SettingRow label="Report Issue">
          <a
            href="https://github.com/yhk1038/claude-code-gui-jetbrains/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-text-link hover:text-text-link hover:underline"
          >
            Open Issue
          </a>
        </SettingRow>
      </SettingSection>
    </div>
  );
}
