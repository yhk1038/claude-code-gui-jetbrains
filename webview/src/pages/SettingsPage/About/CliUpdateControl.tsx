import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowPathIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { UpdateMode } from '@/shared';
import { useCliUpdate } from '@/hooks/queries/useCliUpdate';
import { useConfirmDialog } from '@/components/ConfirmDialog/useConfirmDialog';

const BUTTON_CLASS =
  'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ' +
  'bg-accent-primary-hover hover:bg-accent-primary text-text-primary ' +
  'disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

/**
 * Update affordance shown left of the CLI version when a newer version exists.
 *
 * The shape depends on how the CLI was installed (from GET_CLI_UPDATE_INFO):
 *  - VERSIONED (npm/pnpm/yarn/volta): a dropdown to pick Stable or Latest.
 *  - SIMPLE (native/homebrew/winget): a plain Update button (latest of channel).
 *  - NONE: nothing (the whole control renders null).
 *
 * Either path first confirms (an update can interrupt running Claude processes),
 * then shows a spinner while running and a toast with the new version on success.
 */
export function CliUpdateControl() {
  const { info, updating, update } = useCliUpdate();
  const { confirmDialog, confirm } = useConfirmDialog();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on any outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  if (!info || !info.updatable || info.updateMode === UpdateMode.NONE) return null;

  const runUpdate = async (version: string | null, fallbackLabel: string | null) => {
    setMenuOpen(false);
    const ok = await confirm({
      title: 'Update Claude Code',
      message: 'Updating replaces the Claude Code CLI and may interrupt running sessions. Continue?',
      confirmLabel: 'Update',
    });
    if (!ok) return;
    try {
      const newVersion = await update(version);
      toast.success(`Claude Code v${newVersion ?? version ?? fallbackLabel ?? ''} Updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const spinner = <ArrowPathIcon className="w-3 h-3 animate-spin" />;

  if (info.updateMode === UpdateMode.SIMPLE) {
    return (
      <>
        <button className={BUTTON_CLASS} disabled={updating} onClick={() => runUpdate(null, info.latest)}>
          {updating ? spinner : null}
          {updating ? 'Updating…' : 'Update'}
        </button>
        {confirmDialog}
      </>
    );
  }

  // VERSIONED → dropdown of Stable / Latest.
  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          className={BUTTON_CLASS}
          disabled={updating}
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          {updating ? spinner : null}
          {updating ? 'Updating…' : 'Update'}
          {!updating && <ChevronDownIcon className="w-3 h-3" />}
        </button>

        {menuOpen && !updating && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 z-10 min-w-[9rem] py-1 rounded-md bg-surface-raised border border-border-default shadow-lg"
          >
            {info.stable && (
              <button
                role="menuitem"
                className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover"
                onClick={() => runUpdate(info.stable, info.stable)}
              >
                <span>Stable</span>
                <span className="text-text-tertiary">{info.stable}</span>
              </button>
            )}
            {info.latest && (
              <button
                role="menuitem"
                className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-xs text-text-primary hover:bg-surface-hover"
                onClick={() => runUpdate(info.latest, info.latest)}
              >
                <span>Latest</span>
                <span className="text-text-tertiary">{info.latest}</span>
              </button>
            )}
          </div>
        )}
      </div>
      {confirmDialog}
    </>
  );
}
