import { useEffect } from 'react';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { AnnouncementPlacement } from '@/shared';
import { Portal } from '../../Portal';
import { AnnouncementCard } from '../AnnouncementCard';

/**
 * MODAL 플레이스먼트 공지 슬롯.
 *
 * `Portal` + backdrop으로 우선순위 최상위 공지 1건만 접근성 있는 최소 모달로
 * 띄운다(`ConfirmDialog`와 같은 패턴). `announcement.dismissible`이 true일
 * 때만 배경 클릭/Escape로 닫힌다 — false면 `ConfirmDialog`의 강제 확인
 * 다이얼로그처럼 액션 버튼으로만 닫을 수 있다(카드 자체의 X 버튼도
 * dismissible에 따라 이미 숨겨진다).
 */
export function AnnouncementModalSlot() {
  const { announcements, dismiss } = useAnnouncements(AnnouncementPlacement.MODAL);
  const announcement = announcements[0];

  useEffect(() => {
    if (!announcement?.dismissible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismiss(announcement.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [announcement, dismiss]);

  if (!announcement) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && announcement.dismissible) {
      dismiss(announcement.id);
    }
  };

  return (
    <Portal>
      <div
        data-testid="announcement-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay-scrim"
        onClick={handleBackdropClick}
      >
        <div role="dialog" aria-modal="true" className="w-full max-w-md">
          <AnnouncementCard announcement={announcement} onDismiss={dismiss} />
        </div>
      </div>
    </Portal>
  );
}
