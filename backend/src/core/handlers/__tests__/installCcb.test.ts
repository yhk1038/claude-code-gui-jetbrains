import { describe, it, expect, vi, beforeEach } from 'vitest';

// Command runs through child_process; stub it so nothing actually installs.
// execFileSync is stubbed because augmented-path may probe for nvm.
vi.mock('child_process', () => ({
  execFile: vi.fn(),
  spawn: vi.fn(() => ({ on: vi.fn() })),
  execFileSync: vi.fn(() => ''),
}));
// Spy on the cache reset without pulling the real usage module's other exports.
vi.mock('../getUsage', () => ({ resetUsageCache: vi.fn() }));

import { execFile as cpExecFile } from 'child_process';
import { installCcbHandler } from '../installCcb';
import { resetUsageCache } from '../getUsage';
import type { ConnectionManager } from '../../../ws/connection-manager';
import type { Bridge } from '../../../bridge/bridge-interface';
import type { IPCMessage } from '../../types';
import { MessageType } from '../../../shared';

const mockExecFile = vi.mocked(cpExecFile);
const mockResetUsageCache = vi.mocked(resetUsageCache);
const bridge = {} as Bridge;
const msg: IPCMessage = { type: MessageType.INSTALL_CCB, payload: {}, timestamp: 0, requestId: 'req-1' };

type Cb = (err: Error | null, stdout: string, stderr: string) => void;
function fakeExecFile(res: { stdout?: string; stderr?: string; err?: Error | null }) {
  return ((_f: string, _a: readonly string[], _o: unknown, cb: Cb) => {
    cb(res.err ?? null, res.stdout ?? '', res.stderr ?? '');
    return { on: vi.fn() };
  }) as never;
}

function mockConns() {
  return { sendTo: vi.fn(), broadcastToAll: vi.fn() } as unknown as ConnectionManager;
}

function lastPayload(conns: ConnectionManager): Record<string, unknown> {
  const calls = (conns.sendTo as ReturnType<typeof vi.fn>).mock.calls;
  return calls[calls.length - 1][2];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('installCcbHandler', () => {
  it('runs `npm install -g claude-code-battery`, acks ok, and clears the usage cache', async () => {
    mockExecFile.mockImplementation(fakeExecFile({ stdout: 'added 1 package' }));
    const conns = mockConns();

    await installCcbHandler('c1', msg, conns, bridge);

    expect(lastPayload(conns)).toEqual({ requestId: 'req-1', status: 'ok' });
    expect(mockResetUsageCache).toHaveBeenCalledTimes(1);
    // Regardless of the win32 cmd.exe wrapping, the argv carries the install spec.
    const argv = (mockExecFile.mock.calls[0][1] as string[]).join(' ');
    expect(argv).toContain('install -g claude-code-battery');
  });

  it('returns a runnable command on a permission failure and does NOT clear the cache', async () => {
    mockExecFile.mockImplementation(fakeExecFile({
      err: Object.assign(new Error('Command failed'), { code: 1 }),
      stderr: 'npm error code EACCES\nnpm error EACCES: permission denied',
    }));
    const conns = mockConns();

    await installCcbHandler('c1', msg, conns, bridge);

    const p = lastPayload(conns);
    expect(p.status).toBe('error');
    expect(String(p.error)).toMatch(/npm install -g claude-code-battery/);
    expect(mockResetUsageCache).not.toHaveBeenCalled();
  });

  it('surfaces a generic failure output', async () => {
    mockExecFile.mockImplementation(fakeExecFile({
      err: new Error('Command failed'),
      stderr: 'npm error network ETIMEDOUT',
    }));
    const conns = mockConns();

    await installCcbHandler('c1', msg, conns, bridge);

    const p = lastPayload(conns);
    expect(p.status).toBe('error');
    expect(String(p.error)).toContain('network ETIMEDOUT');
  });
});
