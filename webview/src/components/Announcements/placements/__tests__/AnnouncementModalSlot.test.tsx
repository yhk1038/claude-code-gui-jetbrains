import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnnouncementModalSlot } from '../AnnouncementModalSlot';
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
    placements: [AnnouncementPlacement.MODAL],
    priority: 0,
    icon: 'BellIcon',
    title: 'Modal title',
    body: 'Modal body',
    dismissible: true,
    actions: [],
    target: { frequency: AnnouncementFrequency.ALWAYS },
    ...overrides,
  };
}

describe('AnnouncementModalSlot', () => {
  beforeEach(() => {
    mockDismiss.mockClear();
    mockUseAnnouncements.mockReset();
  });

  it('공지가 있으면 dialog를 표시하고 올바른 placement로 조회한다', () => {
    mockUseAnnouncements.mockReturnValue({ announcements: [makeAnnouncement()], dismiss: mockDismiss });
    render(<AnnouncementModalSlot />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Modal title')).toBeInTheDocument();
    expect(mockUseAnnouncements).toHaveBeenCalledWith(AnnouncementPlacement.MODAL);
  });

  it('공지가 없으면 아무것도 렌더하지 않는다', () => {
    mockUseAnnouncements.mockReturnValue({ announcements: [], dismiss: mockDismiss });
    render(<AnnouncementModalSlot />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dismissible=true일 때 배경 클릭 시 dismiss(id)가 호출된다', () => {
    mockUseAnnouncements.mockReturnValue({
      announcements: [makeAnnouncement({ id: 'close-me', dismissible: true })],
      dismiss: mockDismiss,
    });
    render(<AnnouncementModalSlot />);
    fireEvent.click(screen.getByTestId('announcement-modal-backdrop'));
    expect(mockDismiss).toHaveBeenCalledWith('close-me');
  });

  it('dismissible=true일 때 Escape 키 입력 시 dismiss(id)가 호출된다', () => {
    mockUseAnnouncements.mockReturnValue({
      announcements: [makeAnnouncement({ id: 'close-me', dismissible: true })],
      dismiss: mockDismiss,
    });
    render(<AnnouncementModalSlot />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockDismiss).toHaveBeenCalledWith('close-me');
  });

  it('dismissible=false면 배경 클릭/Escape로 닫히지 않는다', () => {
    mockUseAnnouncements.mockReturnValue({
      announcements: [makeAnnouncement({ id: 'stay', dismissible: false })],
      dismiss: mockDismiss,
    });
    render(<AnnouncementModalSlot />);
    fireEvent.click(screen.getByTestId('announcement-modal-backdrop'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
