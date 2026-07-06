import { useMemo, useState } from 'react';
import { SettingSection, SettingRow } from '../common';
import { PERMISSION_SPECS, type PermissionSpec } from '@/permissions';
import { useTranslation } from '@/i18n';

interface Props {
  className?: string;
}

export const PermissionsSection = (props: Props) => {
  const { className = '' } = props;
  const { t } = useTranslation('settings');
  const availableSpecs = useMemo(
    () => PERMISSION_SPECS.filter((s) => s.available()),
    [],
  );

  if (availableSpecs.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <SettingSection title={t('browser.permissions.title')}>
        {availableSpecs.map((spec) => (
          <PermissionRow key={spec.id} spec={spec} />
        ))}
      </SettingSection>
    </div>
  );
};

interface PermissionRowProps {
  spec: PermissionSpec;
}

function PermissionRow(props: PermissionRowProps) {
  const { spec } = props;
  const { t } = useTranslation('settings');
  const [state, setState] = useState<NotificationPermission>(spec.getState());

  const handleRequest = () => {
    spec
      .request()
      .then((next) => setState(next))
      .catch(() => setState(spec.getState()));
  };

  return (
    <SettingRow
      label={spec.label}
      description={
        state === 'granted'
          ? t('browser.permissions.revokeHint')
          : state === 'denied'
            ? t('browser.permissions.deniedHint')
            : spec.description
      }
    >
      {state === 'granted' && (
        <span className="text-sm text-state-success-fg font-medium">{t('browser.permissions.granted')}</span>
      )}
      {state === 'denied' && (
        <span className="text-sm text-text-tertiary font-medium">{t('browser.permissions.denied')}</span>
      )}
      {state === 'default' && (
        <button
          type="button"
          onClick={handleRequest}
          className="px-3 py-1 rounded text-sm font-medium bg-accent-primary text-text-inverse hover:opacity-90 transition-opacity"
        >
          {t('browser.permissions.request')}
        </button>
      )}
    </SettingRow>
  );
}
