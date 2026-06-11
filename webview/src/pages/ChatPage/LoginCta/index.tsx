import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useRouter } from '@/router';
import { Route } from '@/router/routes';
import { useAuthContext } from '@/contexts';

interface Props {
  className?: string;
}

/**
 * Inline "Log in" button shown next to a CLI authentication-failure message.
 * Clicking it opens the account/login page. Auto-hides once the user is
 * authenticated, so a stale auth error left in the transcript doesn't keep
 * showing a login prompt forever.
 */
export function LoginCta(props: Props) {
  const { className = '' } = props;
  const { navigate } = useRouter();
  const { loggedIn } = useAuthContext();

  if (loggedIn === true) return null;

  return (
    <button
      type="button"
      onClick={() => navigate(Route.SWITCH_ACCOUNT)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-accent-claude hover:bg-accent-claude-hover text-text-primary transition-colors ${className}`}
    >
      <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" />
      Log in
    </button>
  );
}
