import { useState } from 'react';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useRouter } from '@/router';
import { Route } from '@/router/routes';
import { useAuthContext } from '@/contexts';

interface Props {
  className?: string;
}

/**
 * Status-aware login control shown next to a CLI authentication-failure message.
 *
 * Same size/background/text-color in both states — only opacity differs:
 * - Logged in:  "Signed", dimmed (50%), inactive. Clicking silently re-checks
 *   auth status (spinner shows while in flight) without leaving the chat.
 * - Logged out: "Re-Sign", full opacity, active. Clicking opens the login page.
 *
 * It never disappears, so a stale auth error in the transcript reads correctly:
 * dimmed "Signed" once the user is authenticated again, prominent "Re-Sign"
 * while still logged out.
 */
export function LoginCta(props: Props) {
  const { className = '' } = props;
  const { navigate } = useRouter();
  const { loggedIn, refetch } = useAuthContext();
  const [isRechecking, setIsRechecking] = useState(false);

  const isSignedIn = loggedIn === true;

  const handleClick = async () => {
    if (isSignedIn) {
      if (isRechecking) return;
      setIsRechecking(true);
      try {
        await refetch();
      } finally {
        setIsRechecking(false);
      }
      return;
    }
    navigate(Route.SWITCH_ACCOUNT);
  };

  return (
    <button
      type="button"
      onClick={() => { void handleClick(); }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-accent-claude text-text-primary transition-opacity ${isSignedIn ? 'opacity-50 hover:opacity-60' : 'opacity-100 hover:bg-accent-claude-hover'} ${className}`}
    >
      {isRechecking ? (
        <span className="w-3.5 h-3.5 border-2 border-border-strong border-t-text-primary rounded-full animate-spin" />
      ) : (
        <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" />
      )}
      {isSignedIn ? 'Signed' : 'Re-Sign'}
    </button>
  );
}
