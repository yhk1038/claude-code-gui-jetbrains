import { useState, useRef, useEffect } from 'react';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { useAccounts } from '@/hooks/queries/useAccounts';
import { useAuthContext } from '@/contexts';
import { AccountSwitcherMenu } from './AccountSwitcherMenu';
import { AccountAvatar } from './AccountAvatar';

/**
 * Header "persona" button next to Settings: an avatar showing the active
 * account's initials, opening a quick account-switch dropdown. Hidden until the
 * user is logged in (no account to show). Click-outside closes it, mirroring
 * SessionDropdown.
 */
export function AccountSwitcher() {
  const { loggedIn } = useAuthContext();
  const { accounts } = useAccounts();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  if (loggedIn !== true) return null;

  const activeAccount = accounts.find((a) => a.active) ?? null;

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded transition-colors hover:bg-surface-hover"
        title="Accounts"
      >
        {activeAccount ? (
          <AccountAvatar account={activeAccount} className="w-5 h-5 text-[0.6153rem]" />
        ) : (
          <UserCircleIcon className="w-5 h-5 text-text-secondary hover:text-text-primary" />
        )}
      </button>

      {open && <AccountSwitcherMenu onClose={() => setOpen(false)} />}
    </div>
  );
}
