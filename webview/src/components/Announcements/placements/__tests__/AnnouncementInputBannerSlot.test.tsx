import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnnouncementInputBannerSlot } from '../AnnouncementInputBannerSlot';
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
    placements: [AnnouncementPlacement.INPUT_BANNER],
    priority: 0,
    icon: 'BellIcon',
    title: 'Input banner title',
    body: 'Input banner body',
    dismissible: true,
    actions: [],
    target: { frequency: AnnouncementFrequency.UNTIL_DISMISSED },
    ...overrides,
  };
}

describe('AnnouncementInputBannerSlot', () => {
  beforeEach(() => {
    mockDismiss.mockClear();
    mockUseAnnouncements.mockReset();
  });

  it('공지가 있으면 카드를 표시하고 올바른 placement로 조회한다', () => {
    mockUseAnnouncements.mockReturnValue({ announcements: [makeAnnouncement()], dismiss: mockDismiss });
    render(<AnnouncementInputBannerSlot />);
    expect(screen.getByText('Input banner title')).toBeInTheDocument();
    expect(mockUseAnnouncements).toHaveBeenCalledWith(AnnouncementPlacement.INPUT_BANNER);
  });

  it('공지가 없으면 아무것도 렌더하지 않는다', () => {
    mockUseAnnouncements.mockReturnValue({ announcements: [], dismiss: mockDismiss });
    const { container } = render(<AnnouncementInputBannerSlot />);
    expect(container).toBeEmptyDOMElement();
  });

  it('닫기(X) 클릭 시 dismiss(announcement)가 호출된다', () => {
    const announcement = makeAnnouncement({ id: 'close-me' });
    mockUseAnnouncements.mockReturnValue({ announcements: [announcement], dismiss: mockDismiss });
    render(<AnnouncementInputBannerSlot />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(mockDismiss).toHaveBeenCalledWith(announcement);
  });

  it('frequency가 ALWAYS여도 dismissible이면 닫기(X)가 존재한다', () => {
    const announcement = makeAnnouncement({ id: 'always-1', target: { frequency: AnnouncementFrequency.ALWAYS } });
    mockUseAnnouncements.mockReturnValue({ announcements: [announcement], dismiss: mockDismiss });
    render(<AnnouncementInputBannerSlot />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(mockDismiss).toHaveBeenCalledWith(announcement);
  });

  it('여러 공지 중 priority가 가장 높은 것(목록의 첫 항목)만 표시한다', () => {
    mockUseAnnouncements.mockReturnValue({
      announcements: [makeAnnouncement({ id: 'top', title: 'Top priority' }), makeAnnouncement({ id: 'second', title: 'Second' })],
      dismiss: mockDismiss,
    });
    render(<AnnouncementInputBannerSlot />);
    expect(screen.getByText('Top priority')).toBeInTheDocument();
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
  });
});
