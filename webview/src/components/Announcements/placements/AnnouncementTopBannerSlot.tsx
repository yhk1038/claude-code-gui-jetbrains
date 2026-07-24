import { useAnnouncements } from '@/hooks/useAnnouncements';
import { AnnouncementPlacement } from '@/shared';
import { knownActions } from '@/vendor/announcement-core/eligibility';
import { InputBanner } from '@/pages/ChatPage/InputBanner';
import { resolveAnnouncementIcon } from '../AnnouncementCard';
import { RestrictedMarkdown } from '../RestrictedMarkdown';
import { useAnnouncementActionDispatch } from '../useAnnouncementActionDispatch';

/**
 * TOP_BANNER 플레이스먼트 공지 슬롯.
 *
 * `ChatPage`의 `BannerArea` 스택(`UpdateBanner`/`ConnectionLostBanner`/
 * `AuthErrorBanner`/`BrowserPermissionBanner`)에 형제로 마운트한다. 이 스택의
 * 다른 상단배너들은 모두 **한 줄 가로 배너**(좌측 문구, 우측 액션+X 닫기가 같은
 * 행)다. `AnnouncementCard`는 세로 카드(아이콘 | 제목/본문/액션 세로 스택)라
 * 이 자리에 그대로 쓰면 액션 버튼이 본문 아래로 내려가 형제 배너들과 레이아웃이
 * 어긋난다 — 그래서 카드 대신 인풋배너 계열의 `InputBanner`
 * (message(좌)/actions(우)/onClose(X) 구조, 프로젝트 UI 용어상 "인풋배너"와
 * 동일한 좌-우-X 규칙)로 감싸 가로 한 줄로 재배치한다. 아이콘·제목·본문
 * 마크다운·액션 디스패치·dismiss 동작은 `AnnouncementCard`와 동일하게 유지하고
 * 배치만 바꾼다.
 */
export function AnnouncementTopBannerSlot() {
  const { announcements, dismiss } = useAnnouncements(AnnouncementPlacement.TOP_BANNER);
  const dispatch = useAnnouncementActionDispatch();
  const announcement = announcements[0];
  if (!announcement) return null;

  const Icon = resolveAnnouncementIcon(announcement.icon);
  const actions = knownActions(announcement);

  return (
    <div className="w-full bg-surface-base px-4 py-1.5">
      <InputBanner
        message={
          <div className="flex items-start gap-2 min-w-0">
            <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-text-secondary" aria-hidden="true" />
            <div className="min-w-0">
              <div className="font-medium text-text-primary">{announcement.title}</div>
              <div className="text-text-secondary">
                <RestrictedMarkdown body={announcement.body} />
              </div>
            </div>
          </div>
        }
        actions={
          actions.length > 0 ? (
            <>
              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => dispatch(announcement, action, dismiss)}
                  className="rounded px-2 py-1 font-medium text-primary hover:bg-state-info-bg transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </>
          ) : undefined
        }
        onClose={announcement.dismissible ? () => dismiss(announcement) : undefined}
      />
    </div>
  );
}
