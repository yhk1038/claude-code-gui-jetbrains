import { ROUTE_META, ICON_COMPONENTS, SETTINGS_SUB_ROUTES } from '@/router/routes';
import { useRouter } from '@/router';

export function SettingsSidebar() {
  const { route, navigate } = useRouter();

  return (
    <nav className="w-48 flex-shrink-0 border-r border-zinc-800 py-4">
      <ul className="space-y-1 px-2">
        {SETTINGS_SUB_ROUTES.map((subRoute) => {
          const meta = ROUTE_META[subRoute];
          const Icon = meta.icon ? ICON_COMPONENTS[meta.icon] : null;
          const isActive = route === subRoute;

          return (
            <li key={subRoute}>
              <button
                onClick={() => navigate(subRoute)}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                  ${isActive
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'}
                `}
              >
                {Icon && <Icon className="w-4 h-4" />}
                <span>{meta.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
