import { SparklesIcon } from '@heroicons/react/24/outline';
import { InputBanner } from './InputBanner';
import type { FableNoticeVariant } from '@/hooks/useFableNotice';

/**
 * "Learn more" target. claude.ai's web bundle actually references this news
 * link for Fable (issue #153 appendix E), so we use it rather than the
 * anthropic.com/claude/fable form.
 */
const FABLE_LEARN_MORE_URL = 'https://www.anthropic.com/news/fable-mythos-access';

interface Props {
  /**
   * Which notice to render: 'available' (CLI can select Fable) shows the promo
   * card; 'update-required' (CLI < 2.1.170) nudges the user to update instead.
   */
  variant: FableNoticeVariant;
  /** X(닫기) 클릭 — 공지를 영구히 숨긴다(useFableNotice가 영속화). */
  onClose: () => void;
}

/**
 * Fable 5 notice (issue #153), styled after Cursor's "Auto mode is enabled"
 * card: an icon + bold title, a muted body paragraph, and a trailing
 * "Learn more" link, sitting just above the composer as an InputBanner.
 *
 * Two variants:
 *  - 'available': the CLI can select Fable — the promo card. Title is ours
 *    (there is no official Fable "now available" card — claude.ai only surfaces
 *    Fable as a usage notice); the body is the CLI's own Fable usage copy, kept
 *    verbatim rather than invented.
 *  - 'update-required': the CLI is too old to know `--model fable`, so we point
 *    the user at the CLI updater in Settings → About instead of offering a model
 *    they can't select.
 */
export function FableNoticeBanner(props: Props) {
  const { variant, onClose } = props;

  const title = variant === 'available' ? 'Fable is now available' : 'Update to use Fable 5';
  const body =
    variant === 'available' ? (
      <>
        You can use up to 50% of your plan limits on Fable 5 through July 7. After
        that, switch to usage credits to continue using it.
      </>
    ) : (
      <>
        Fable 5 requires Claude Code CLI v2.1.170 or newer. Update your CLI in
        Settings → About to select it.
      </>
    );

  return (
    <InputBanner
      message={
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 font-medium text-[0.9230rem]">
            <SparklesIcon className="h-4 w-4 flex-shrink-0" />
            {title}
          </span>
          <span className="text-text-tertiary text-[0.8461rem]">
            {body}{' '}
            <a
              href={FABLE_LEARN_MORE_URL}
              target="_blank"
              rel="noreferrer"
              className="text-text-link hover:underline"
            >
              Learn more
            </a>
          </span>
        </div>
      }
      onClose={onClose}
    />
  );
}
