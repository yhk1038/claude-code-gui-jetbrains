import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JetBrainsBridge, parseProjectRoots } from '../jetbrains-bridge';
import { MessageType } from '../../shared';
import * as settings from '../../core/features/settings';

type MsgHandler = (data: Buffer) => void;
type CloseHandler = () => void;

function createMockWs() {
  const handlers: { message?: MsgHandler; close?: CloseHandler } = {};
  const ws = {
    readyState: 1,
    send: vi.fn(),
    on: vi.fn((event: string, cb: MsgHandler | CloseHandler) => {
      if (event === 'message') handlers.message = cb as MsgHandler;
      if (event === 'close') handlers.close = cb as CloseHandler;
    }),
    // test helpers
    emitMessage: (obj: unknown) =>
      handlers.message?.(Buffer.from(JSON.stringify(obj))),
    emitClose: () => handlers.close?.(),
  };
  return ws as typeof ws & { emitMessage: (o: unknown) => void; emitClose: () => void };
}

function registerRoots(ws: ReturnType<typeof createMockWs>, roots: string[]) {
  ws.emitMessage({ jsonrpc: '2.0', method: 'REGISTER_PROJECT_ROOTS', params: { roots } });
}

/** The JSON-RPC method name sent on the wire for a given request. */
function sentMethod(ws: ReturnType<typeof createMockWs>): string | undefined {
  const call = ws.send.mock.calls[0]?.[0];
  return call ? (JSON.parse(call) as { method: string }).method : undefined;
}

describe('parseProjectRoots', () => {
  it('extracts a string array', () => {
    expect(parseProjectRoots({ roots: ['/a', '/b'] })).toEqual(['/a', '/b']);
  });
  it('drops non-string and empty entries', () => {
    expect(parseProjectRoots({ roots: ['/a', 1, '', null] })).toEqual(['/a']);
  });
  it('returns [] when absent or malformed', () => {
    expect(parseProjectRoots(undefined)).toEqual([]);
    expect(parseProjectRoots({})).toEqual([]);
    expect(parseProjectRoots({ roots: 'oops' })).toEqual([]);
  });
});

describe('JetBrainsBridge cross-IDE routing', () => {
  it('routes a request to the IDE that owns the path', async () => {
    const bridge = new JetBrainsBridge();
    const wsA = createMockWs();
    const wsB = createMockWs();
    bridge.addRpcClient(wsA as never);
    bridge.addRpcClient(wsB as never);
    registerRoots(wsA, ['/projA']);
    registerRoots(wsB, ['/projB']);

    const pending = bridge
      .openDiff({ filePath: '/projB/src/x.ts', oldContent: '', newContent: '' })
      .catch(() => {}); // request resolves only on a response; we assert the send target

    expect(wsB.send).toHaveBeenCalledTimes(1);
    expect(wsA.send).not.toHaveBeenCalled();
    expect(sentMethod(wsB)).toBe('OPEN_DIFF');
    await Promise.resolve();
    void pending;
  });

  it('does not record project roots as a normal notification request', () => {
    const bridge = new JetBrainsBridge();
    const ws = createMockWs();
    const handler = vi.fn();
    bridge.onNotification('REGISTER_PROJECT_ROOTS', handler);
    bridge.addRpcClient(ws as never);
    registerRoots(ws, ['/projA']);
    // The built-in interception must consume it, not the user handler.
    expect(handler).not.toHaveBeenCalled();
  });

  it('falls back to the remaining client after the owner disconnects', async () => {
    const bridge = new JetBrainsBridge();
    const wsA = createMockWs();
    const wsB = createMockWs();
    bridge.addRpcClient(wsA as never);
    bridge.addRpcClient(wsB as never);
    registerRoots(wsA, ['/projA']);
    registerRoots(wsB, ['/projB']);

    wsB.emitClose(); // owner of /projB goes away

    const pending = bridge
      .openFile('/projB/src/x.ts')
      .catch(() => {});

    // Only wsA remains open → it receives the request as a fallback.
    expect(wsA.send).toHaveBeenCalledTimes(1);
    expect(sentMethod(wsA)).toBe('OPEN_FILE');
    await Promise.resolve();
    void pending;
  });

  it('rejects when no client is connected', async () => {
    const bridge = new JetBrainsBridge();
    await expect(bridge.openFile('/x.ts')).rejects.toThrow(/No RPC client connected/);
  });
});

/** Parse the JSON-RPC message at call index [callIdx] sent to [ws]. */
function sentMessage(
  ws: ReturnType<typeof createMockWs>,
  callIdx = 0,
): { jsonrpc: string; method?: string; params?: Record<string, unknown>; id?: string } | undefined {
  const call = ws.send.mock.calls[callIdx]?.[0];
  return call ? JSON.parse(call) : undefined;
}

describe('JetBrainsBridge.pushHostMode', () => {
  it('sends a HOST_MODE_CHANGED JSON-RPC notification (no id) to a single client', () => {
    const bridge = new JetBrainsBridge();
    const ws = createMockWs();
    bridge.addRpcClient(ws as never);
    ws.send.mockClear(); // ignore any connect-time push

    bridge.pushHostMode('tool-window', ws as never);

    expect(ws.send).toHaveBeenCalledTimes(1);
    const msg = sentMessage(ws);
    expect(msg?.method).toBe(MessageType.HOST_MODE_CHANGED);
    expect(msg?.params).toEqual({ hostMode: 'tool-window' });
    // A notification carries NO id (so Kotlin never tries to reply).
    expect(msg?.id).toBeUndefined();
  });

  it('broadcasts to every connected client when no target ws is given', () => {
    const bridge = new JetBrainsBridge();
    const wsA = createMockWs();
    const wsB = createMockWs();
    bridge.addRpcClient(wsA as never);
    bridge.addRpcClient(wsB as never);
    wsA.send.mockClear();
    wsB.send.mockClear();

    bridge.pushHostMode('editor-tab');

    expect(sentMessage(wsA)?.method).toBe(MessageType.HOST_MODE_CHANGED);
    expect(sentMessage(wsA)?.params).toEqual({ hostMode: 'editor-tab' });
    expect(sentMessage(wsB)?.params).toEqual({ hostMode: 'editor-tab' });
  });
});

describe('JetBrainsBridge connect-time hostMode push', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('pushes the current hostMode to a newly connected RPC client', async () => {
    vi.spyOn(settings, 'readSettingsFile').mockResolvedValue({ hostMode: 'tool-window' });

    const bridge = new JetBrainsBridge();
    const ws = createMockWs();
    bridge.addRpcClient(ws as never);

    // The connect-time push reads settings asynchronously; let microtasks drain.
    await vi.waitFor(() => {
      expect(ws.send).toHaveBeenCalled();
    });

    const msg = sentMessage(ws);
    expect(msg?.method).toBe(MessageType.HOST_MODE_CHANGED);
    expect(msg?.params).toEqual({ hostMode: 'tool-window' });
  });
});
