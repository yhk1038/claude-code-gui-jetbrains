import { api } from '@/api/ClaudeCodeApi';
import {
  SOUND_OFF,
  useNotificationSound,
  useSystemSounds,
  type SoundSelection,
} from '@/notifications';
import { SettingSection, SettingRow } from '../common';
import { Select, type SelectOption } from '@/components/Select';
import { useTranslation } from '@/i18n';

interface Props {
  className?: string;
}

/**
 * Settings UI for picking the desktop-notification sound.
 *
 * The list is fetched from the Node.js backend (`LIST_SYSTEM_SOUNDS`) and
 * is therefore OS-specific (macOS aiff, Windows wav, Linux freedesktop ogg).
 * Changing the selection plays a one-shot preview via `PLAY_SYSTEM_SOUND`.
 *
 * The first option is always `Off`. When the backend returns no sounds the
 * select is rendered with `Off` only plus an explanatory hint. While the
 * fetch is in flight the select is disabled.
 */
export const NotificationsSection = (props: Props) => {
  const { className = '' } = props;
  const { t } = useTranslation('settings');
  const { selection, setSelection } = useNotificationSound();
  const { sounds, loading, error } = useSystemSounds();

  const handleChange = (next: SoundSelection) => {
    setSelection(next);
    if (next !== SOUND_OFF) {
      // Fire-and-forget preview; failures are silently logged.
      api.sounds.play(next).catch((err: unknown) => {
        console.warn('[NotificationsSection] preview failed:', err);
      });
    }
  };

  const soundOptions: SelectOption[] = [
    { value: SOUND_OFF, label: t('browser.notifications.sound.off') },
    ...sounds.map((sound) => ({ value: sound.id, label: sound.label })),
  ];

  const isEmpty = !loading && error === null && sounds.length === 0;
  const description =
    error !== null
      ? t('browser.notifications.sound.errorDescription', { error })
      : loading
        ? t('browser.notifications.sound.loadingDescription')
        : isEmpty
          ? t('browser.notifications.sound.emptyDescription')
          : t('browser.notifications.sound.description');

  return (
    <div className={className}>
      <SettingSection title={t('browser.notifications.title')}>
        <SettingRow label={t('browser.notifications.sound.label')} description={description}>
          <Select
            value={selection}
            options={soundOptions}
            ariaLabel={t('browser.notifications.sound.ariaLabel')}
            disabled={loading || error !== null}
            onChange={(value) => handleChange(value as SoundSelection)}
            className="bg-surface-overlay border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary"
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
};
