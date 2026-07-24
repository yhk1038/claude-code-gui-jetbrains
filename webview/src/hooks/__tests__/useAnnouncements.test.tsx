import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import {
  AnnouncementFrequency,
  AnnouncementPlacement,
  MessageType,
  type Announcement,
  type GetAnnouncementsResult,
} from '@/shared';
import { createTestQueryClient, makeQueryWrapper } from '../queries/__tests__/testQueryClient';

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock('@/contexts/BridgeContext', () => ({
  useBridgeContext: () => ({ isConnected: true, send: mockSend, subscribe: vi.fn(), lastError: null }),
}));

import { useAnnouncements } from '../useAnnouncements';

type HookReturn = ReturnType<typeof useAnnouncements>;

const okVersion = { status: 'ok', pluginVersion: '0.22.0', cliVersion: null, requiresRestart: false };

function makeAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'a1',
    placements: [AnnouncementPlacement.TOP_BANNER],
    priority: 0,
    icon: 'sparkles',
    title: 'Title',
    body: 'Body',
    dismissible: true,
    actions: [],
    target: { frequency: AnnouncementFrequency.UNTIL_DISMISSED },
    ...overrides,
  };
}

/**
 * Route `send` by message type: version (so useVersionInfo settles), the
 * announcements feed, and dismiss persistence. Each test seeds `feed`/`dismissed`.
 */
function primeSend(feed: Announcement[], dismissed: string[]) {
  const result: GetAnnouncementsResult = { schemaVersion: 1, announcements: feed, dismissedIds: dismissed };
  mockSend.mockImplementation((type: string, _payload?: unknown) => {
    if (type === MessageType.GET_VERSION) return Promise.resolve(okVersion);
    if (type === MessageType.GET_ANNOUNCEMENTS) return Promise.resolve(result);
    if (type === MessageType.DISMISS_ANNOUNCEMENT) return Promise.resolve({ dismissedIds: dismissed });
    return Promise.resolve(null);
  });
}

let current: HookReturn | null = null;
function Probe() {
  current = useAnnouncements(AnnouncementPlacement.TOP_BANNER);
  return null;
}

function renderHook() {
  render(<Probe />, { wrapper: makeQueryWrapper(createTestQueryClient()) });
}

function dismissCalls(): string[] {
  return mockSend.mock.calls
    .filter((c) => c[0] === MessageType.DISMISS_ANNOUNCEMENT)
    .map((c) => (c[1] as { id: string }).id);
}

describe('useAnnouncements', () => {
  beforeEach(() => {
    mockSend.mockReset();
    current = null;
  });

  it('records a ONCE announcement permanently the moment it is shown', async () => {
    const once = makeAnnouncement({ id: 'once-1', target: { frequency: AnnouncementFrequency.ONCE } });
    primeSend([once], []);
    renderHook();

    await waitFor(() => expect(dismissCalls()).toContain('once-1'));
    // The exposure record persists via DISMISS_ANNOUNCEMENT with the ONCE id.
    expect(mockSend).toHaveBeenCalledWith(MessageType.DISMISS_ANNOUNCEMENT, { id: 'once-1' });
  });

  it('does not record UNTIL_DISMISSED just from being shown', async () => {
    const ud = makeAnnouncement({ id: 'ud-1', target: { frequency: AnnouncementFrequency.UNTIL_DISMISSED } });
    primeSend([ud], []);
    renderHook();

    await waitFor(() => expect(current?.announcements.map((a) => a.id)).toEqual(['ud-1']));
    expect(dismissCalls()).not.toContain('ud-1');
  });

  it('dismiss(UNTIL_DISMISSED) persists the dismissal and hides it locally', async () => {
    const ud = makeAnnouncement({ id: 'ud-1', target: { frequency: AnnouncementFrequency.UNTIL_DISMISSED } });
    primeSend([ud], []);
    renderHook();
    await waitFor(() => expect(current?.announcements).toHaveLength(1));

    await act(async () => {
      current!.dismiss(ud);
    });

    expect(dismissCalls()).toContain('ud-1');
    expect(current?.announcements).toHaveLength(0);
  });

  it('dismiss(ALWAYS) hides it locally but never persists (comes back on re-query)', async () => {
    const always = makeAnnouncement({ id: 'always-1', target: { frequency: AnnouncementFrequency.ALWAYS } });
    primeSend([always], []);
    renderHook();
    await waitFor(() => expect(current?.announcements).toHaveLength(1));

    await act(async () => {
      current!.dismiss(always);
    });

    // Local-only: excluded from the current view, but no DISMISS_ANNOUNCEMENT sent.
    expect(current?.announcements).toHaveLength(0);
    expect(dismissCalls()).not.toContain('always-1');
  });
});
