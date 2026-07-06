import { useState } from 'react';
import Tippy from '@tippyjs/react/headless';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { UpdateMode } from '@/shared';
import { useCliUpdate } from '@/hooks/queries/useCliUpdate';
import { useConfirmDialog } from '@/components/ConfirmDialog/useConfirmDialog';
import { compareVersions } from '@/utils/compareVersions';
import { useTranslation } from '@/i18n';

const BUTTON_CLASS =
  'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ' +
  'bg-accent-primary-hover hover:bg-accent-primary text-text-primary ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

/**
 * One channel row in the dropdown. Its state is relative to the installed version:
 *  - equal → not actionable (green check, dimmed label, no pointer events).
 *  - older → a downgrade (undo icon), still clickable.
 *  - newer → an upgrade (download icon), clickable.
 */
function VersionItem(props: { label: string; version: string; current: string | null; onClick: () => void }) {
  const { label, version, current, onClick } = props;
  const cmp = current ? compareVersions(version, current) : 1;
  const isCurrent = cmp === 0;
  const isDowngrade = cmp < 0;

  const Icon = isCurrent ? CheckCircleIcon : isDowngrade ? ArrowUturnLeftIcon : ArrowDownTrayIcon;

  return (
    <button
      role="menuitem"
      onClick={isCurrent ? undefined : onClick}
      disabled={isCurrent}
      className={
        'flex w-full items-center justify-between gap-4 px-3 py-1.5 text-xs text-text-primary ' +
        (isCurrent ? 'pointer-events-none cursor-default' : 'hover:bg-surface-hover')
      }
    >
      <span className={`font-medium ${isCurrent ? 'opacity-50' : ''}`}>{label}</span>
      <span className="flex items-center gap-1.5 text-text-tertiary">
        {version}
        <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-state-success-fg' : ''}`} />
      </span>
    </button>
  );
}

/**
 * Update affordance shown left of the CLI version when a newer version exists.
 *
 * The shape depends on how the CLI was installed (from GET_CLI_UPDATE_INFO):
 *  - VERSIONED (npm/pnpm/yarn/volta): a Tippy dropdown to pick Stable or Latest.
 *  - SIMPLE (native/homebrew/winget): a plain Update button (latest of channel).
 *  - NONE: nothing (the whole control renders null).
 *
 * Either path first confirms (an update can interrupt running Claude processes),
 * then shows a spinner while running and a toast with the new version on success.
 */
export function CliUpdateControl() {
  const { t } = useTranslation('settings');
  const { info, updating, update } = useCliUpdate();
  const { confirmDialog, confirm } = useConfirmDialog();
  const [menuOpen, setMenuOpen] = useState(false);

  // No affordance for install methods we can't update non-interactively, or until
  // we actually know both the installed version and the latest release.
  if (!info || info.updateMode === UpdateMode.NONE || !info.cliVersion || !info.latest) return null;

  // Already on (or ahead of) the latest release → show a static "Up to date" note
  // in the button's place rather than leaving it empty.
  if (!info.updatable) {
    return (
      <span className="flex items-center gap-1 text-xs text-text-tertiary">
        <CheckCircleIcon className="w-3.5 h-3.5 text-state-success-fg" />
        {t('about.cliUpdate.upToDate')}
      </span>
    );
  }

  const runUpdate = async (version: string | null, fallbackLabel: string | null) => {
    setMenuOpen(false);
    const ok = await confirm({
      title: t('about.cliUpdate.confirmTitle'),
      message: t('about.cliUpdate.confirmMessage'),
      confirmLabel: t('about.cliUpdate.update'),
    });
    if (!ok) return;
    try {
      const newVersion = await update(version);
      toast.success(t('about.cliUpdate.updateSuccess', { value: newVersion ?? version ?? fallbackLabel ?? '' }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('about.cliUpdate.updateFailed'));
    }
  };

  const spinner = <ArrowPathIcon className="w-3 h-3 animate-spin" />;

  if (info.updateMode === UpdateMode.SIMPLE) {
    return (
      <>
        <button className={BUTTON_CLASS} disabled={updating} onClick={() => runUpdate(null, info.latest)}>
          {updating ? spinner : null}
          {updating ? t('about.cliUpdate.updating') : t('about.cliUpdate.update')}
        </button>
        {confirmDialog}
      </>
    );
  }

  // VERSIONED → Tippy dropdown of Stable / Latest.
  return (
    <>
      <Tippy
        visible={menuOpen && !updating}
        onClickOutside={() => setMenuOpen(false)}
        interactive
        placement="bottom-start"
        offset={[0, 4]}
        render={(attrs) => (
          <div
            role="menu"
            className="min-w-[9rem] py-1 rounded-md bg-surface-raised border border-border-default shadow-lg"
            {...attrs}
          >
            {info.stable && (
              <VersionItem
                label={t('about.cliUpdate.channel.stable')}
                version={info.stable}
                current={info.cliVersion}
                onClick={() => runUpdate(info.stable, info.stable)}
              />
            )}
            {info.latest && (
              <VersionItem
                label={t('about.cliUpdate.channel.latest')}
                version={info.latest}
                current={info.cliVersion}
                onClick={() => runUpdate(info.latest, info.latest)}
              />
            )}
          </div>
        )}
      >
        <button
          className={BUTTON_CLASS}
          disabled={updating}
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          {updating ? spinner : null}
          {updating ? t('about.cliUpdate.updating') : t('about.cliUpdate.update')}
          {!updating && <ChevronDownIcon className="w-3 h-3" />}
        </button>
      </Tippy>
      {confirmDialog}
    </>
  );
}
