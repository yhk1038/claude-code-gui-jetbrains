import { useState } from 'react';
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useRouter } from '@/router';
import { Route, ROUTE_META, Label } from '@/router/routes';
import { getBridge } from '@/api/bridge/Bridge';
import { getAdapter } from '@/adapters';
import { useSessionContext } from '@/contexts/SessionContext';

interface Props {
  className?: string;
}

type LoginMethod = 'claude-ai' | 'console';

export function SwitchAccount(props: Props) {
  const { className } = props;
  const { navigate } = useRouter();
  const meta = ROUTE_META[Route.SWITCH_ACCOUNT];

  const { workingDirectory } = useSessionContext();
  const [loadingMethod, setLoadingMethod] = useState<LoginMethod | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (method: LoginMethod) => {
    if (loadingMethod !== null) return;

    setLoadingMethod(method);
    setError(null);

    try {
      const result = await getBridge().request<{ requestId: string; status: string; error?: string }>(
        'LOGIN',
        { method },
      );

      if (result?.status === 'ok') {
        navigate(Route.NEW_SESSION);
      } else {
        setError(result?.error ?? 'Login failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoadingMethod(null);
    }
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
    <div className={`flex flex-col h-full bg-[#1a1a1a] ${className ?? ''}`}>
      <header className="flex items-center gap-2 px-2 py-1 border-b border-zinc-800">
        <button
          onClick={() => navigate(Route.NEW_SESSION)}
          className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          title={Label.BACK}
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </button>
        <h1 className="text-sm font-semibold text-zinc-100">{meta.label}</h1>
      </header>

      <div className="flex-1 overflow-y-auto flex items-center justify-center">
        <div className="max-w-md w-full px-8">
          <img
            src="/welcome-art-dark.svg"
            alt="Welcome art"
            className="w-full mb-6"
            draggable={false}
          />

          <p className="text-sm text-zinc-300 leading-relaxed">
            Claude Code can be used with your Claude subscription or billed based on API usage through your Console account.
          </p>

          <p className="text-sm text-zinc-300 mt-4">
            How do you want to log in?
          </p>

          {error !== null && (
            <p className="text-xs text-red-400 mt-3 px-3 py-2 bg-red-950/40 border border-red-800/50 rounded-lg">
              {error}
            </p>
          )}

          <button
            onClick={() => { void handleLogin('claude-ai'); }}
            disabled={loadingMethod !== null}
            className="w-full mt-6 py-3 rounded-lg bg-[#D97757] hover:bg-[#c5684a] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loadingMethod === 'claude-ai' && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            Claude.ai Subscription
          </button>
          <p className="text-xs text-zinc-500 mt-1.5">
            Use your Claude Pro, Team, or Enterprise subscription
          </p>

          <button
            onClick={() => { void handleLogin('console'); }}
            disabled={loadingMethod !== null}
            className="w-full mt-5 py-3 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loadingMethod === 'console' && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            Anthropic Console
          </button>
          <p className="text-xs text-zinc-500 mt-1.5">
            Pay for API usage through your Console account
          </p>

          <button
            onClick={() => { void handleOpenProviderDocs(); }}
            disabled={loadingMethod !== null}
            className="w-full mt-5 py-3 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-1.5"
          >
            Bedrock, Foundry, or Vertex
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
          </button>
          <p className="text-xs text-zinc-500 mt-1.5">
            Instructions on how to use API keys or third-party providers.
          </p>

          <p className="text-xs text-zinc-500 mt-10 text-center">
            Prefer the terminal experience?{' '}
            <button
              onClick={() => { void handleOpenTerminal(); }}
              className="text-blue-400 hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit text-xs"
            >
              Run claude in terminal
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
