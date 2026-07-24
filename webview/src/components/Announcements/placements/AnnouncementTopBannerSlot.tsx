import { useAnnouncements } from '@/hooks/useAnnouncements';
import { AnnouncementPlacement } from '@/shared';
import { AnnouncementCard } from '../AnnouncementCard';

/**
 * TOP_BANNER 플레이스먼트 공지 슬롯.
 *
 * `ChatPage`의 `BannerArea` 스택(`UpdateBanner`/`ConnectionLostBanner`/
 * `AuthErrorBanner`/`BrowserPermissionBanner`)에 형제로 마운트한다. 다른
 * 상단배너들은 폭 100%의 무테두리 스트립이지만, 공지 카드는 아이콘·이미지·
 * 액션 버튼을 함께 담아야 해서 `AnnouncementCard`의 카드형 레이아웃을 그대로
 * 유지한다 — 스택과의 좌우/상하 여백만 다른 상단배너와 맞춘다.
 */
export function AnnouncementTopBannerSlot() {
  const { announcements, dismiss } = useAnnouncements(AnnouncementPlacement.TOP_BANNER);
  const announcement = announcements[0];
  if (!announcement) return null;

  return (
    <div className="w-full bg-surface-base px-4 py-1.5">
      <AnnouncementCard announcement={announcement} onDismiss={dismiss} />
    </div>
  );
}
