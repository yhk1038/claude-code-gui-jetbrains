import { ROUTE_META, ICON_COMPONENTS, SETTINGS_SUB_ROUTES, Route } from '@/router/routes';
import { useRouter } from '@/router';
import { useUpdateAvailable } from '@/hooks/useUpdateAvailable';
import { useSponsorMenuUnlock } from '@/hooks/useSponsorMenuUnlock';
import { isBrowser } from '@/config/environment';
import { useTranslation } from '@/i18n';

interface SettingsSidebarProps {
  /** On mobile the sidebar renders as a slide-in drawer instead of an inline column. */
  isDrawer?: boolean;
  /** Drawer open state (only meaningful when isDrawer). */
  open?: boolean;
  /** Called after a nav item is chosen, so the drawer can close itself on mobile. */
  onNavigate?: () => void;
}

export function SettingsSidebar({ isDrawer = false, open = false, onNavigate }: SettingsSidebarProps) {
  const { route, navigate } = useRouter();
  const { hasUpdate } = useUpdateAvailable();
  const browser = isBrowser();
  // Sponsor is hidden by default; unlocked via a double-click on the About
  // heading (see AboutSettings) while Lemon Squeezy is still in test mode.
  const { unlocked: sponsorUnlocked } = useSponsorMenuUnlock();
  const { t } = useTranslation('settings');

  return (
    <nav
      className={`w-48 flex-shrink-0 border-e border-border-default py-4 bg-surface-base ${
        isDrawer
          ? `absolute start-0 top-0 bottom-0 z-20 transition-transform duration-200 ${
              open ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
            }`
          : ''
      }`}
    >
      <ul className="space-y-1 px-2">
        {SETTINGS_SUB_ROUTES.map((subRoute) => {
          if (subRoute === Route.SETTINGS_BROWSER && !browser) {
            return null;
          }
          if (subRoute === Route.SETTINGS_SPONSOR && !sponsorUnlocked) {
            return null;
          }
          const meta = ROUTE_META[subRoute];
          const Icon = meta.icon ? ICON_COMPONENTS[meta.icon] : null;
          // Section labels live in ROUTE_META (also consumed outside React), so we
          // translate at the render site: the route key's last segment maps to a
          // `nav.*` key in the settings namespace (e.g. 'settings/general' → nav.general).
          const navLabel = t(`nav.${subRoute.replace('settings/', '')}`);
          const isActive = route === subRoute;
          const showBadge = subRoute === Route.SETTINGS_RELEASES && hasUpdate;

          return (
            <li key={subRoute}>
              <button
                onClick={() => { navigate(subRoute); onNavigate?.(); }}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                  ${isActive
                    ? 'bg-surface-overlay text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'}
                `}
              >
                {Icon && <Icon className="w-4 h-4" />}
                <span>{navLabel}</span>
                {showBadge && (
                  <span className="ms-auto w-2 h-2 rounded-full bg-accent-primary" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
