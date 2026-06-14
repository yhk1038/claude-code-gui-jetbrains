import { useState } from 'react';
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useRouter } from '@/router';
import { Route, ROUTE_META, Label } from '@/router/routes';
import { getBridge, LOGIN_REQUEST_TIMEOUT_MS } from '@/api/bridge/Bridge';
import { getAdapter } from '@/adapters';
import { useSessionContext } from '@/contexts/SessionContext';
import { useAuthContext } from '@/contexts';
import { LoginUrlModal } from './LoginUrlModal';

interface Props {
  className?: string;
}

type LoginMethod = 'claude-ai' | 'console';

export function SwitchAccountPage(props: Props) {
  const { className } = props;
  const { navigate } = useRouter();
  const meta = ROUTE_META[Route.SWITCH_ACCOUNT];

  const { workingDirectory } = useSessionContext();
  const { refetch } = useAuthContext();
  const [loadingMethod, setLoadingMethod] = useState<LoginMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);

  const handleLogin = async (method: LoginMethod) => {
    if (loadingMethod !== null) return;

    setLoadingMethod(method);
    setError(null);
    setLoginUrl(null);

    // The CLI prints the OAuth URL and (where it can) opens the browser itself,
    // without telling us whether that auto-open succeeded. So the backend forwards
    // the URL via LOGIN_URL_AVAILABLE rather than opening it — opening it ourselves
    // would double-open on macOS/Windows. We show it in a modal and let the user
    // open it when needed (e.g. WSL, where claude can't). (#57)
    const unsubscribeUrl = getBridge().subscribe('LOGIN_URL_AVAILABLE', (message) => {
      const url = message.payload?.url as string | undefined;
      if (url) setLoginUrl(url);
    });

    try {
      const result = await getBridge().request<{ requestId: string; status: string; error?: string }>(
        'LOGIN',
        { method },
        { timeout: LOGIN_REQUEST_TIMEOUT_MS },
      );

      if (result?.status === 'ok') {
        // Re-query auth status before navigating so the chat login gate
        // (useLoginGate) sees the fresh logged-in state. Without this, navigate
        // happens while AuthContext.loggedIn is still the stale `false`, and the
        // gate bounces the user right back to this login screen (#99).
        await refetch();
        navigate(Route.NEW_SESSION);
      } else {
        setError(result?.error ?? 'Login failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      unsubscribeUrl();
      setLoginUrl(null);
      setLoadingMethod(null);
    }
  };

  const handleOpenLoginUrl = async () => {
    if (loginUrl === null) return;
    try {
      await getAdapter().openUrl(loginUrl);
    } catch (err) {
      console.error('[SwitchAccount] Failed to open login URL:', err);
    }
  };

  const handleSubmitCode = (code: string): void => {
    getBridge().sendRaw({
      type: 'SUBMIT_LOGIN_CODE',
      payload: { code },
      timestamp: Date.now(),
    });
  };

  const handleOpenProviderDocs = async () => {
    try {
      await getAdapter().openUrl('https://code.claude.com/docs/en/vs-code#using-third-party-providers');
    } catch (err) {
      console.error('[SwitchAccount] Failed to open provider docs URL:', err);
    }
  };

  const handleOpenTerminal = async () => {
    try {
      await getAdapter().openTerminal(workingDirectory ?? '');
    } catch (err) {
      console.error('[SwitchAccount] Failed to open terminal:', err);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-surface-base ${className ?? ''}`}>
      <header className="flex items-center gap-2 px-2 py-1 border-b border-border-default">
        <button
          onClick={() => navigate(Route.NEW_SESSION)}
          className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          title={Label.BACK}
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </button>
        <h1 className="text-sm font-semibold text-text-primary">{meta.label}</h1>
      </header>

      <div className="flex-1 overflow-y-auto flex items-center justify-center">
        <div className="max-w-md w-full px-8">
          <img
            src="/welcome-art-dark.svg"
            alt="Welcome art"
            className="w-full mb-6"
            draggable={false}
          />

          <p className="text-sm text-text-secondary leading-relaxed">
            Claude Code can be used with your Claude subscription or billed based on API usage through your Console account.
          </p>

          <p className="text-sm text-text-secondary mt-4">
            How do you want to log in?
          </p>

          {error !== null && (
            <p className="text-xs text-state-error-fg mt-3 px-3 py-2 bg-state-error-bg border border-state-error-border rounded-lg">
              {error}
            </p>
          )}

          <button
            onClick={() => { void handleLogin('claude-ai'); }}
            disabled={loadingMethod !== null}
            className="w-full mt-6 py-3 rounded-lg bg-accent-claude hover:bg-accent-claude-hover disabled:opacity-60 disabled:cursor-not-allowed text-text-primary font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loadingMethod === 'claude-ai' && (
              <span className="w-4 h-4 border-2 border-border-strong border-t-text-primary rounded-full animate-spin" />
            )}
            Claude.ai Subscription
          </button>
          <p className="text-xs text-text-tertiary mt-1.5">
            Use your Claude Pro, Team, or Enterprise subscription
          </p>

          <button
            onClick={() => { void handleLogin('console'); }}
            disabled={loadingMethod !== null}
            className="w-full mt-5 py-3 rounded-lg bg-surface-overlay border border-border-default hover:bg-surface-tooltip disabled:opacity-60 disabled:cursor-not-allowed text-text-primary font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loadingMethod === 'console' && (
              <span className="w-4 h-4 border-2 border-border-strong border-t-text-primary rounded-full animate-spin" />
            )}
            Anthropic Console
          </button>
          <p className="text-xs text-text-tertiary mt-1.5">
            Pay for API usage through your Console account
          </p>

          <button
            onClick={() => { void handleOpenProviderDocs(); }}
            disabled={loadingMethod !== null}
            className="w-full mt-5 py-3 rounded-lg bg-surface-overlay border border-border-default hover:bg-surface-tooltip disabled:opacity-60 disabled:cursor-not-allowed text-text-primary font-semibold text-sm transition-colors flex items-center justify-center gap-1.5"
          >
            Bedrock, Foundry, or Vertex
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
          </button>
          <p className="text-xs text-text-tertiary mt-1.5">
            Instructions on how to use API keys or third-party providers.
          </p>

          <p className="text-xs text-text-tertiary mt-10 text-center">
            Prefer the terminal experience?{' '}
            <button
              onClick={() => { void handleOpenTerminal(); }}
              className="text-text-link hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit text-xs"
            >
              Run claude in terminal
            </button>
          </p>
        </div>
      </div>

      {loginUrl !== null && (
        <LoginUrlModal
          onOpenUrl={() => { void handleOpenLoginUrl(); }}
          onSubmitCode={handleSubmitCode}
          onClose={() => setLoginUrl(null)}
        />
      )}
    </div>
  );
}
