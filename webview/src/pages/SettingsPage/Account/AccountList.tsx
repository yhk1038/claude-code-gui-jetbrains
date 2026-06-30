import { useState, useEffect, useRef } from 'react';
import { useAccounts } from '@/hooks/queries/useAccounts';
import type { AccountListItem } from '@/shared';
import { AccountRow } from './AccountRow';

/**
 * Saved-accounts list. On mount, automatically saves the current account if it
 * is not yet in the registry (covers accounts logged in outside the plugin).
 */
export function AccountList() {
  const { accounts, activeEmail, isLoading, error, save, switchTo, remove } = useAccounts();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // The live account email we last auto-saved for. Keyed by email (not a one-shot
  // boolean) so a NEW account logged in elsewhere (e.g. a terminal `claude` login)
  // is captured too — not just the very first one seen on mount.
  const autoSavedEmailRef = useRef<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (isLoading || !activeEmail) return;
    // The live account is already saved (marked active) — nothing to capture.
    if (accounts.some((a) => a.active)) return;
    // Already attempted a save for this exact live account — don't loop on it.
    if (autoSavedEmailRef.current === activeEmail) return;
    autoSavedEmailRef.current = activeEmail;
    void run(save);
    // run/save are recreated each render; the per-email ref guards re-execution
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, accounts, activeEmail]);

  const handleDelete = (account: AccountListItem) => {
    void run(() => remove(account.id));
  };

  const shownError = actionError ?? error;

  return (
    <div>
      {shownError && (
        <p className="text-[0.8461rem] text-state-error-fg mb-3 px-3 py-2 bg-state-error-bg border border-state-error-border rounded-lg">
          {shownError}
        </p>
      )}

      {accounts.length === 0 ? (
        <p className="text-[0.8461rem] text-text-tertiary py-2">
          {isLoading ? 'Loading accounts…' : 'No saved accounts yet.'}
        </p>
      ) : (
        <div>
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              busy={busy}
              onSwitch={(id) => void run(() => switchTo(id))}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
