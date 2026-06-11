import { useAuthContext } from '@/contexts';
import { LoadedMessageDto, getTextContent } from '../../../types';
import { LoginCta } from '../LoginCta';

interface Props {
  message: LoadedMessageDto;
}

/**
 * Renders the CLI's authentication-failure entry (401 / authentication_failed)
 * as a single line — a red status dot, the dimmed error text, and an inline
 * login CTA pushed to the right edge.
 */
export function AuthErrorRenderer(props: Props) {
  const { message } = props;
  const { loggedIn } = useAuthContext();

  return (
    <div className="group pt-2 pb-4 px-6">
      <div className="flex items-center gap-3 flex-wrap text-text-primary text-[1rem] leading-relaxed">
        <span className={`${loggedIn ? 'text-green-500' : 'text-red-500 animate animate-pulse'} mt-[1px] text-[0.6923rem]`}>●</span>
        <span className="opacity-75 mr-auto">{getTextContent(message)}</span>
        <LoginCta />
      </div>
    </div>
  );
}
