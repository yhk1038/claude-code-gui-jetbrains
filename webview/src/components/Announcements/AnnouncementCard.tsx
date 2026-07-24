import type { ComponentType, SVGProps } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '@/i18n';
import { IconName, ICON_COMPONENTS } from '@/router';
import { AnnouncementFrequency, type Announcement } from '@/shared';
import { RestrictedMarkdown } from './RestrictedMarkdown';
import { useAnnouncementActionDispatch } from './useAnnouncementActionDispatch';
import { isSafeImageUrl } from './urlSafety';

/**
 * Maps `announcement.icon` (an open-ended server string) to a bundled Heroicon
 * component. Never trusts the server string as a component/SVG reference
 * directly — an unregistered name falls back to a default icon, preventing
 * remote SVG/markup injection through this field.
 */
export function resolveAnnouncementIcon(icon: string): ComponentType<SVGProps<SVGSVGElement>> {
  const isKnown = (Object.values(IconName) as string[]).includes(icon);
  return isKnown ? ICON_COMPONENTS[icon as IconName] : ICON_COMPONENTS[IconName.INFORMATION_CIRCLE];
}

interface Props {
  announcement: Announcement;
  /** Called for the card's own X close button and for a `DISMISS`-typed action. */
  onDismiss: (id: string) => void;
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
        {announcement.actions.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {announcement.actions.map((action) => (
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
      {announcement.dismissible && announcement.target.frequency !== AnnouncementFrequency.ALWAYS && (
        <button
          type="button"
          onClick={() => onDismiss(announcement.id)}
          aria-label={t('announcementCard.close')}
          className="flex-shrink-0 self-start rounded p-0.5 text-text-tertiary hover:bg-state-info-bg transition-colors"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
