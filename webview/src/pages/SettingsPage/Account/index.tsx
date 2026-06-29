import { PlusIcon } from '@heroicons/react/24/outline';
import { useRouter } from '@/router/useRouter';
import { ROUTE_META, Route } from '@/router/routes';
import { AccountList } from './AccountList';

export function AccountSettings() {
  const meta = ROUTE_META[Route.SETTINGS_ACCOUNT];
  const { navigate } = useRouter();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text-primary">{meta.label}</h2>
        <button
          onClick={() => navigate(Route.SWITCH_ACCOUNT)}
          className="flex items-center gap-1.5 text-[0.8461rem] text-text-primary bg-accent-claude hover:bg-accent-claude-hover rounded px-3 py-1.5 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add account
        </button>
      </div>

      <AccountList />
    </div>
  );
}
