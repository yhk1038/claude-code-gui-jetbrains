import { useAnnouncements } from '@/hooks/useAnnouncements';
import { AnnouncementPlacement } from '@/shared';
import { AnnouncementCard } from '../AnnouncementCard';

/**
 * EMPTY_STATE 플레이스먼트 공지 슬롯.
 *
 * 초기화된 세션(아직 첫 메시지를 시작하지 않은 상태)의 중앙 빈 화면에, 우선순위가
 * 가장 높은 공지 1건만 카드로 표시한다. 공지가 없거나(로딩 중 포함) 목록이
 * 비어 있으면 `null`을 렌더해 기존 EmptyState 레이아웃에 전혀 영향을 주지 않는다.
 */
export function AnnouncementEmptyStateSlot() {
  const { announcements, dismiss } = useAnnouncements(AnnouncementPlacement.EMPTY_STATE);
  const announcement = announcements[0];
  if (!announcement) return null;

  return (
    <div className="w-full max-w-[22rem]">
      <AnnouncementCard announcement={announcement} onDismiss={dismiss} />
    </div>
  );
}
