import { useEffect } from 'react';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { AnnouncementPlacement } from '@/shared';
import { AnnouncementView } from '@/vendor/announcement-ui';
import { Portal } from '../../Portal';
import { useAnnouncementActionDispatch } from '../useAnnouncementActionDispatch';

/**
 * MODAL 플레이스먼트 공지 슬롯.
 *
 * `Portal` + backdrop으로 우선순위 최상위 공지 1건만 접근성 있는 최소 모달로
 * 띄운다(`ConfirmDialog`와 같은 패턴). `announcement.dismissible`이 true일
 * 때만 배경 클릭/Escape로 닫힌다 — false면 `ConfirmDialog`의 강제 확인
 * 다이얼로그처럼 액션 버튼으로만 닫을 수 있다(카드 자체의 X 버튼도
 * dismissible에 따라 이미 숨겨진다).
 *
 * Portal/backdrop/Escape 골격은 유지하고, 내용만 www admin과 공유하는 vendored
 * `AnnouncementView variant="card"`로 렌더한다. `announcement-scope`는
 * `--ann-*` CSS 변수를 플러그인 테마에 매핑한다.
 */
export function AnnouncementModalSlot() {
  const { announcements, dismiss } = useAnnouncements(AnnouncementPlacement.MODAL);
  const dispatch = useAnnouncementActionDispatch();
  const announcement = announcements[0];

  useEffect(() => {
    if (!announcement?.dismissible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss(announcement);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [announcement, dismiss]);

  if (!announcement) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && announcement.dismissible) {
      dismiss(announcement);
    }
  };

  return (
    <Portal>
      <div
        data-testid="announcement-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay-scrim"
        onClick={handleBackdropClick}
      >
        <div role="dialog" aria-modal="true" className="announcement-scope w-full max-w-md">
          <AnnouncementView
            announcement={announcement}
            variant="card"
            onAction={(action) => dispatch(announcement, action, dismiss)}
            onDismiss={() => dismiss(announcement)}
          />
        </div>
      </div>
    </Portal>
  );
}
