import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useRouter } from '@/router';
import { Label, ROUTE_META, Route } from '@/router/routes';

export function SettingsHeader() {
  const { navigate } = useRouter();
  const meta = ROUTE_META[Route.SETTINGS];

  return (
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
  );
}
