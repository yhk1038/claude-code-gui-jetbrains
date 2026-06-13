import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('../../claude', () => ({
  Claude: { spawn: vi.fn() },
}));

import { loginHandler, cancelLogin } from '../login';
import { Claude } from '../../claude';
import type { ConnectionManager } from '../../../ws/connection-manager';
import type { Bridge } from '../../../bridge/bridge-interface';
import type { IPCMessage } from '../../types';

const mockSpawn = vi.mocked(Claude.spawn);

type FakeChild = EventEmitter & { kill: ReturnType<typeof vi.fn> };

function fakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.kill = vi.fn();
  return child;
}

function createMockConnections() {
  return { sendTo: vi.fn() } as unknown as ConnectionManager;
}

const mockBridge = {} as Bridge;

async function runLogin(method: unknown, exitCode: number, connections = createMockConnections()) {
  const child = fakeChild();
  mockSpawn.mockReturnValue(child as never);
  const message: IPCMessage = { type: 'LOGIN', payload: method === undefined ? {} : { method }, requestId: 'r1', timestamp: 0 };
  const promise = loginHandler('c1', message, connections, mockBridge);
  child.emit('close', exitCode);
  await promise;
  return connections;
}

describe('loginHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps method "console" to the --console flag', async () => {
    await runLogin('console', 0);
    expect(mockSpawn).toHaveBeenCalledWith(['auth', 'login', '--console'], expect.anything());
  });

  it('maps method "claude-ai" to the --claudeai flag', async () => {
    await runLogin('claude-ai', 0);
    expect(mockSpawn).toHaveBeenCalledWith(['auth', 'login', '--claudeai'], expect.anything());
  });

  it('defaults to --claudeai when no method is provided', async () => {
    await runLogin(undefined, 0);
    expect(mockSpawn).toHaveBeenCalledWith(['auth', 'login', '--claudeai'], expect.anything());
  });

  it('sends an ok ACK when the CLI exits 0', async () => {
    const connections = await runLogin('console', 0);
    expect(connections.sendTo).toHaveBeenCalledWith('c1', 'ACK', expect.objectContaining({
      requestId: 'r1',
      status: 'ok',
    }));
  });

  it('sends an error ACK when the CLI exits non-zero', async () => {
    const connections = await runLogin('console', 1);
    expect(connections.sendTo).toHaveBeenCalledWith('c1', 'ACK', expect.objectContaining({
      requestId: 'r1',
      status: 'error',
    }));
  });
});

describe('cancelLogin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('kills the in-flight login child for the connection and forgets it', () => {
    const child = fakeChild();
    mockSpawn.mockReturnValue(child as never);
    const connections = createMockConnections();
    const message: IPCMessage = { type: 'LOGIN', payload: { method: 'claude-ai' }, requestId: 'r1', timestamp: 0 };
    // Login is in flight: the child has NOT closed yet.
    void loginHandler('c1', message, connections, mockBridge);

    expect(cancelLogin('c1')).toBe(true);
    expect(child.kill).toHaveBeenCalled();

    // The child is forgotten, so a second cancel is a no-op.
    expect(cancelLogin('c1')).toBe(false);
  });

  it('returns false when the connection has no in-flight login', () => {
    expect(cancelLogin('no-such-connection')).toBe(false);
  });
});
