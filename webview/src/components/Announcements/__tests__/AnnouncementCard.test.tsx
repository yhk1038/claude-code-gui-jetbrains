import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnnouncementCard, resolveAnnouncementIcon } from '../AnnouncementCard';
import { IconName, ICON_COMPONENTS } from '@/router';
import { AnnouncementActionType, AnnouncementFrequency, type Announcement } from '@/shared';

const mockDispatch = vi.fn();
vi.mock('../useAnnouncementActionDispatch', () => ({
  useAnnouncementActionDispatch: () => mockDispatch,
}));

function makeAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'a1',
    placements: [],
    priority: 0,
    icon: 'BellIcon',
    title: 'Announcement title',
    body: 'Announcement **body**',
    dismissible: true,
    actions: [],
    target: { frequency: AnnouncementFrequency.UNTIL_DISMISSED },
    ...overrides,
  };
}

describe('resolveAnnouncementIcon', () => {
  it('등록된 아이콘 이름은 대응하는 컴포넌트를 반환한다', () => {
    expect(resolveAnnouncementIcon(IconName.BELL)).toBe(ICON_COMPONENTS[IconName.BELL]);
  });

  it('미등록 아이콘 이름은 기본(정보) 아이콘으로 폴백한다', () => {
    expect(resolveAnnouncementIcon('SomeUnknownIcon')).toBe(ICON_COMPONENTS[IconName.INFORMATION_CIRCLE]);
  });
});

describe('AnnouncementCard', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('제목과 본문을 표시한다', () => {
    render(<AnnouncementCard announcement={makeAnnouncement()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Announcement title')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument(); // **body** -> <strong>body</strong>
  });

  it('dismissible=true일 때 닫기(X) 버튼이 존재한다', () => {
    render(<AnnouncementCard announcement={makeAnnouncement({ dismissible: true })} onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('dismissible=false일 때 닫기(X) 버튼이 없다', () => {
    render(<AnnouncementCard announcement={makeAnnouncement({ dismissible: false })} onDismiss={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('frequency가 ALWAYS면 dismissible이어도 닫기(X) 버튼이 없다 (닫아도 다시 뜨므로 숨김)', () => {
    render(
      <AnnouncementCard
        announcement={makeAnnouncement({
          dismissible: true,
          target: { frequency: AnnouncementFrequency.ALWAYS },
        })}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('닫기(X) 클릭 시 onDismiss(id)가 호출된다', () => {
    const onDismiss = vi.fn();
    render(<AnnouncementCard announcement={makeAnnouncement({ id: 'close-me' })} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledWith('close-me');
  });

  it('액션 버튼 클릭 시 dispatch가 announcement/action/onDismiss와 함께 호출된다', () => {
    const onDismiss = vi.fn();
    const action = { id: 'act-1', label: 'Open docs', type: AnnouncementActionType.OPEN_URL, url: 'https://example.com' };
    const announcement = makeAnnouncement({ actions: [action] });
    render(<AnnouncementCard announcement={announcement} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open docs' }));
    expect(mockDispatch).toHaveBeenCalledWith(announcement, action, onDismiss);
  });

  it('본문에 script 태그를 넣어도 실행되지 않고 텍스트로만 표시된다', () => {
    const { container } = render(
      <AnnouncementCard announcement={makeAnnouncement({ body: '<script>window.__xss2 = true</script>' })} onDismiss={vi.fn()} />,
    );
    expect((window as unknown as { __xss2?: boolean }).__xss2).toBeUndefined();
    expect(container.querySelector('script')).toBeNull();
  });
});
