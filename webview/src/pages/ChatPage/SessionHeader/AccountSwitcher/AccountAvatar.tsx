import type { StoredAccount } from '@/shared';
import { initialsFor } from './initials';
import { avatarColorClass } from './avatarColor';

function hashId(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

interface Props {
  account: Pick<StoredAccount, 'id' | 'displayName' | 'emailAddress'>;
  /** Size + text-size classes, e.g. "w-6 h-6 text-[0.6153rem]" */
  className?: string;
}

export function AccountAvatar({ account, className = 'w-6 h-6 text-[0.6153rem]' }: Props) {
  const initials = initialsFor(account.displayName, account.emailAddress);
  const colorClass = avatarColorClass(hashId(account.id));
  return (
    <span
      className={`flex items-center justify-center rounded-full font-semibold uppercase leading-none text-white ${colorClass} ${className}`}
    >
      {initials}
    </span>
  );
}
