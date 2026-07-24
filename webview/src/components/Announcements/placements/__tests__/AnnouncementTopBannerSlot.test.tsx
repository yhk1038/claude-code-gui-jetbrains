import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnnouncementTopBannerSlot } from '../AnnouncementTopBannerSlot';
import { AnnouncementFrequency, AnnouncementPlacement, type Announcement } from '@/shared';

const mockDismiss = vi.fn();
const mockUseAnnouncements = vi.fn();
vi.mock('@/hooks/useAnnouncements', () => ({
  useAnnouncements: (placement: AnnouncementPlacement) => mockUseAnnouncements(placement),
}));

// AnnouncementCard(내부에서 사용)의 useAnnouncementActionDispatch가 useRouter/
// useNavigate를 호출하는데, 이 슬롯 테스트에는 <Router> 컨텍스트가 없어
// AnnouncementCard.test.tsx와 동일하게 액션 디스패치 자체를 목킹한다.
vi.mock('@/components/Announcements/useAnnouncementActionDispatch', () => ({
  useAnnouncementActionDispatch: () => vi.fn(),
}));

function makeAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'a1',
    placements: [AnnouncementPlacement.TOP_BANNER],
    priority: 0,
    icon: 'BellIcon',
    title: 'Top banner title',
    body: 'Top banner body',
    dismissible: true,
    actions: [],
    target: { frequency: AnnouncementFrequency.ALWAYS },
    ...overrides,
  };
}

describe('AnnouncementTopBannerSlot', () => {
  beforeEach(() => {
    mockDismiss.mockClear();
    mockUseAnnouncements.mockReset();
  });

  it('공지가 있으면 카드를 표시하고 올바른 placement로 조회한다', () => {
    mockUseAnnouncements.mockReturnValue({ announcements: [makeAnnouncement()], dismiss: mockDismiss });
    render(<AnnouncementTopBannerSlot />);
    expect(screen.getByText('Top banner title')).toBeInTheDocument();
    expect(mockUseAnnouncements).toHaveBeenCalledWith(AnnouncementPlacement.TOP_BANNER);
  });

  it('공지가 없으면 아무것도 렌더하지 않는다', () => {
    mockUseAnnouncements.mockReturnValue({ announcements: [], dismiss: mockDismiss });
    const { container } = render(<AnnouncementTopBannerSlot />);
    expect(container).toBeEmptyDOMElement();
  });

  it('닫기(X) 클릭 시 dismiss(id)가 호출된다', () => {
    mockUseAnnouncements.mockReturnValue({ announcements: [makeAnnouncement({ id: 'close-me' })], dismiss: mockDismiss });
    render(<AnnouncementTopBannerSlot />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(mockDismiss).toHaveBeenCalledWith('close-me');
  });
});
