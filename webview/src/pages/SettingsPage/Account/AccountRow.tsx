import type { ReactElement } from 'react';
import Tippy from '@tippyjs/react/headless';
import { TrashIcon, CheckBadgeIcon, ClockIcon } from '@heroicons/react/24/outline';
import type { AccountListItem } from '@/shared';
import { AccountAvatar } from '@/pages/ChatPage/SessionHeader/AccountSwitcher/AccountAvatar';
import { formatPlan, formatAuthMethod } from '@/utils/accountFormat';

interface AccountRowProps {
  account: AccountListItem;
  busy: boolean;
  onSwitch: (id: string) => void;
  onDelete: (account: AccountListItem) => void;
}

// Calendar-day difference (midnight-based), so "Yesterday" means the previous
// date rather than 24h elapsed.
function calendarDaysAgo(d: Date, now: Date): number {
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((startOf(now) - startOf(d)) / 86_400_000);
}

function lastActiveTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  const daysAgo = calendarDaysAgo(d, now);
  let datePart: string;
  if (daysAgo === 0) datePart = 'Today';
  else if (daysAgo === 1) datePart = 'Yesterday';
  else datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const diff = now.getTime() - ms;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const relative = days > 0 ? `${days}d ago` : hours > 0 ? `${hours}h ago` : minutes > 0 ? `${minutes}m ago` : 'just now';

  return `${datePart} ${time} (${relative})`;
}

function Tooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tippy
      placement="top"
      offset={[0, 4]}
      render={(attrs) => (
        <div
          className="bg-surface-overlay border border-border-default rounded-md px-2 py-1 text-xs text-text-primary shadow-lg"
          {...attrs}
        >
          {label}
        </div>
      )}
    >
      {children}
    </Tippy>
  );
}

function TooltipBadge({ tooltip, value }: { tooltip: string; value: string }) {
  return (
    <Tooltip label={tooltip}>
      <span className="text-[0.7692rem] text-text-tertiary border border-border-default rounded px-1.5 py-0.5 shrink-0 cursor-default">
        {value}
      </span>
    </Tooltip>
  );
}

export function AccountRow(props: AccountRowProps) {
  const { account, busy, onSwitch, onDelete } = props;
  const plan = formatPlan(account.subscriptionType);
  const authMethod = formatAuthMethod(account.authMethod);
  const title = account.displayName ?? account.emailAddress;
  const subtitle = account.displayName ? account.emailAddress : account.organizationName;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border-default last:border-b-0">
      {/* Avatar */}
      <AccountAvatar account={account} className="w-8 h-8 text-[0.7692rem] shrink-0 self-start mt-0.5" />

      {/* Primary info block */}
      <div className="flex-1 min-w-0">
        {/* Row 1: name + badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[0.9230rem] font-medium text-text-primary leading-snug truncate">{title}</span>
          {plan && <TooltipBadge tooltip="Plan" value={plan} />}
          {authMethod && <TooltipBadge tooltip="Auth method" value={authMethod} />}
        </div>

        {/* Row 2: email / org */}
        {subtitle && (
          <div className="text-[0.8076rem] text-text-secondary truncate mt-0.5 leading-snug">{subtitle}</div>
        )}

        {/* Row 3: last active — muted, smallest */}
        <Tooltip label="Last access">
          <span className="inline-flex items-center gap-1 text-[0.7307rem] text-text-tertiary mt-1 cursor-default leading-none w-fit">
            <ClockIcon className="w-3 h-3 shrink-0" />
            {lastActiveTime(account.updatedAt)}
          </span>
        </Tooltip>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {account.active ? (
          <span className="flex items-center gap-1 text-[0.8461rem] text-state-success-fg pr-4">
            <CheckBadgeIcon className="w-4 h-4" />
            In use
          </span>
        ) : (
          <button
            onClick={() => onSwitch(account.id)}
            disabled={busy}
            className="text-[0.8076rem] text-text-primary bg-surface-overlay border border-border-default rounded-md px-3 py-1 hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors leading-snug"
          >
            Switch
          </button>
        )}
        {/* The active account can't be deleted — removing it would orphan the live
            CLI credential slot. Switch to another account first to delete this one. */}
        {!account.active && (
          <button
            onClick={() => onDelete(account)}
            disabled={busy}
            title="Remove account"
            className="p-1.5 rounded-md text-text-tertiary hover:text-state-error-fg hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
