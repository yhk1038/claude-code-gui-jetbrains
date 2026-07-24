import { useAnnouncements } from '@/hooks/useAnnouncements';
import { AnnouncementPlacement } from '@/shared';
import { AnnouncementCard } from '../AnnouncementCard';

/**
 * INPUT_BANNER 플레이스먼트 공지 슬롯.
 *
 * 채팅 인풋 바로 위, `TelemetryConsentBanner`/`FableNoticeBanner`/`InputBanner`
 * (자동모드 강등 안내) 등 기존 인풋배너 계열과 같은 자리에 형제로 마운트한다.
 *
 * `AnnouncementCard` 자체가 이미 `InputBanner`와 동일한 외곽 스타일
 * (`rounded-lg border-border-subtle bg-surface-raised p-3 text-[0.8461rem]`)을
 * 쓰므로 톤은 이미 통일돼 있다 — `InputBanner`로 다시 감싸면 X 닫기 버튼이
 * 중복되고, `useAnnouncementActionDispatch`로 이미 카드 내부에 있는 액션
 * 배선을 슬롯에서 message/actions prop으로 재조립해야 해 중복 배선이 생긴다.
 * 그래서 카드를 직접 렌더하고, 형제 배너들과 동일한 하단 여백(mb-2)만
 * 래퍼에서 맞춘다.
 */
export function AnnouncementInputBannerSlot() {
  const { announcements, dismiss } = useAnnouncements(AnnouncementPlacement.INPUT_BANNER);
  const announcement = announcements[0];
  if (!announcement) return null;

  return (
    <div className="mb-2">
      <AnnouncementCard announcement={announcement} onDismiss={dismiss} />
    </div>
  );
}
