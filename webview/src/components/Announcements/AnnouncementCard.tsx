import type { ComponentType, SVGProps } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '@/i18n';
import { IconName, ICON_COMPONENTS } from '@/router';
import { type Announcement } from '@/shared';
import { isKnownAnnouncementIcon } from '@/vendor/announcement-core/icons';
import { RestrictedMarkdown } from './RestrictedMarkdown';
import { useAnnouncementActionDispatch } from './useAnnouncementActionDispatch';
import { isSafeImageUrl } from './urlSafety';

/**
 * Maps `announcement.icon` (an open-ended server string) to a bundled Heroicon
 * component. The name whitelist is owned by the shared `@ccg/announcement-core`
 * package (`ANNOUNCEMENT_ICON_NAMES`, vendored) — its names are spelling-
 * identical to the plugin's `IconName` enum values, so a whitelisted string
 * indexes `ICON_COMPONENTS` directly. Never trusts the server string as a
 * component/SVG reference: an unrecognized name falls back to a default icon,
 * preventing remote SVG/markup injection through this field.
 */
export function resolveAnnouncementIcon(icon: string): ComponentType<SVGProps<SVGSVGElement>> {
  return isKnownAnnouncementIcon(icon) ? ICON_COMPONENTS[icon as IconName] : ICON_COMPONENTS[IconName.INFORMATION_CIRCLE];
}

interface Props {
  announcement: Announcement;
  /**
   * Called for the card's own X close button and for a `DISMISS`-typed action.
   * Receives the whole announcement so the handler can branch on frequency
   * (ALWAYS = local-only hide vs. others = also persisted).
   */
  onDismiss: (announcement: Announcement) => void;
}

/**
 * Renders a single SDUI `Announcement` (see `shared/announcement.ts`) as a
 * placement-agnostic card: icon + optional image + title + restricted-markdown
 * body + action buttons + optional dismiss (X). Where this card actually
 * mounts per `AnnouncementPlacement` is a later step — this component only
 * needs an `Announcement` and a dismiss callback.
 */
export function AnnouncementCard(props: Props) {
  const { announcement, onDismiss } = props;
  const { t } = useTranslation('common');
  const dispatch = useAnnouncementActionDispatch();
  const Icon = resolveAnnouncementIcon(announcement.icon);
  const actions = announcement.actions;

  return (
    <div className="flex gap-3 rounded-lg border border-border-subtle bg-surface-raised p-3 text-[0.8461rem]">
      <Icon className="h-5 w-5 flex-shrink-0 text-text-secondary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {announcement.imageUrl && isSafeImageUrl(announcement.imageUrl) && (
          <img src={announcement.imageUrl} alt="" className="mb-2 max-w-full rounded" />
        )}
        <div className="font-medium text-text-primary">{announcement.title}</div>
        <div className="mt-1 text-text-secondary">
          <RestrictedMarkdown body={announcement.body} />
        </div>
        {actions.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => dispatch(announcement, action, onDismiss)}
                className="rounded px-2 py-1 font-medium text-primary hover:bg-state-info-bg transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {announcement.dismissible && (
        <button
          type="button"
          onClick={() => onDismiss(announcement)}
          aria-label={t('announcementCard.close')}
          className="flex-shrink-0 self-start rounded p-0.5 text-text-tertiary hover:bg-state-info-bg transition-colors"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
