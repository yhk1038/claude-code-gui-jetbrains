import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MessageType } from '@/shared';

// ---------------------------------------------------------------------------
// Mocks: the reporter talks to the Bridge singleton (fire-and-forget sendRaw,
// since the backend does not ACK PANEL_FOCUSED) and resolves the panelId via
// resolvePanelId. Both are mocked so the test can assert the exact wire message.
// ---------------------------------------------------------------------------

const { sendRawMock, onConnectionChangeMock, unsubscribeMock, resolvePanelIdMock } = vi.hoisted(() => ({
  sendRawMock: vi.fn(),
  onConnectionChangeMock: vi.fn(),
  unsubscribeMock: vi.fn(),
  resolvePanelIdMock: vi.fn(() => 'panel-xyz'),
}));

vi.mock('@/api/bridge/Bridge', () => ({
  getBridge: () => ({ sendRaw: sendRawMock, onConnectionChange: onConnectionChangeMock }),
}));

vi.mock('@/api/bridge/resolvePanelId', () => ({
  resolvePanelId: resolvePanelIdMock,
}));

// Imported AFTER vi.mock so the mocks are wired up first.
import { usePanelFocusReporter } from '../usePanelFocusReporter';

beforeEach(() => {
  vi.clearAllMocks();
  onConnectionChangeMock.mockReturnValue(unsubscribeMock);
  resolvePanelIdMock.mockReturnValue('panel-xyz');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePanelFocusReporter', () => {
  it('reports PANEL_FOCUSED with the resolved panelId when the window gains focus', () => {
    // Not focused at init so the init-report path stays out of the way.
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    renderHook(() => usePanelFocusReporter());
    expect(sendRawMock).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('focus'));

    expect(sendRawMock).toHaveBeenCalledTimes(1);
    expect(sendRawMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.PANEL_FOCUSED,
        payload: { panelId: 'panel-xyz' },
      }),
    );
  });

  it('reports once on init when the document already has focus (opens already-focused)', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    renderHook(() => usePanelFocusReporter());

    expect(sendRawMock).toHaveBeenCalledTimes(1);
    expect(sendRawMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.PANEL_FOCUSED,
        payload: { panelId: 'panel-xyz' },
      }),
    );
  });

  it('stops reporting and unsubscribes after unmount', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const { unmount } = renderHook(() => usePanelFocusReporter());

    unmount();
    window.dispatchEvent(new Event('focus'));

    expect(sendRawMock).not.toHaveBeenCalled();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('swallows a pre-connect sendRaw throw (socket not open yet)', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    sendRawMock.mockImplementation(() => {
      throw new Error('WebSocket is not connected');
    });
    renderHook(() => usePanelFocusReporter());

    expect(() => window.dispatchEvent(new Event('focus'))).not.toThrow();
  });

  it('re-reports on (re)connect while the document has focus', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    renderHook(() => usePanelFocusReporter());
    // init-with-focus already fired once.
    expect(sendRawMock).toHaveBeenCalledTimes(1);

    // Simulate the bridge signalling a (re)connection.
    const connectionCb = onConnectionChangeMock.mock.calls[0][0] as (connected: boolean) => void;
    connectionCb(true);

    expect(sendRawMock).toHaveBeenCalledTimes(2);
  });

  it('reports on focusin — catches an intra-window panel switch that window "focus" misses', () => {
    // Several JCEF panels share one IDE window, so switching to an already-visible
    // panel (e.g. focusing its input) fires focusin but NOT window 'focus'.
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    renderHook(() => usePanelFocusReporter());
    expect(sendRawMock).not.toHaveBeenCalled();

    document.dispatchEvent(new Event('focusin'));

    expect(sendRawMock).toHaveBeenCalledTimes(1);
    expect(sendRawMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.PANEL_FOCUSED,
        payload: { panelId: 'panel-xyz' },
      }),
    );
  });

  it('reports on pointerdown — a click anywhere in the panel marks it the active one', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    renderHook(() => usePanelFocusReporter());
    expect(sendRawMock).not.toHaveBeenCalled();

    document.dispatchEvent(new Event('pointerdown'));

    expect(sendRawMock).toHaveBeenCalledTimes(1);
  });
});
