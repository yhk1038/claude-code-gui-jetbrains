import { useAnnouncements } from '@/hooks/useAnnouncements';
import { AnnouncementPlacement } from '@/shared';
import { AnnouncementView } from '@/vendor/announcement-ui';
import { useAnnouncementActionDispatch } from '../useAnnouncementActionDispatch';

/**
 * TOP_BANNER 플레이스먼트 공지 슬롯.
 *
 * `ChatPage`의 `BannerArea` 스택(`UpdateBanner`/`ConnectionLostBanner`/
 * `AuthErrorBanner`/`BrowserPermissionBanner`)에 형제로 마운트한다. 이 스택의
 * 다른 상단배너들은 모두 한 줄 가로 배너(좌측 문구, 우측 액션+X 닫기가 같은 행)라,
 * 공지도 www admin과 공유하는 vendored `AnnouncementView variant="banner"`
 * (아이콘·제목·본문 좌측, 액션·X 우측)로 렌더해 형제 배너들과 가로 정렬을 맞춘다.
 * 바깥 컨테이너의 배경/여백(`bg-surface-base px-4 py-1.5`)만 슬롯이 유지한다.
 *
 * 렌더는 `AnnouncementView`에 위임하고 슬롯은 동작(액션 디스패치·dismiss)만 콜백으로
 * 주입한다. `announcement-scope`는 `--ann-*` CSS 변수를 플러그인 테마에 매핑한다.
 */
export function AnnouncementTopBannerSlot() {
  const { announcements, dismiss } = useAnnouncements(AnnouncementPlacement.TOP_BANNER);
  const dispatch = useAnnouncementActionDispatch();
  const announcement = announcements[0];
  if (!announcement) return null;

  return (
    <div className="announcement-scope w-full bg-surface-base px-4 py-1.5">
      <AnnouncementView
        announcement={announcement}
        variant="banner"
        onAction={(action) => dispatch(announcement, action, dismiss)}
        onDismiss={() => dismiss(announcement)}
      />
    </div>
  );
}
