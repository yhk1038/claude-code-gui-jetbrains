import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { restartBackendHandler } from '../restartBackend';
import type { ConnectionManager } from '../../../ws/connection-manager';
import type { Bridge } from '../../../bridge/bridge-interface';
import type { IPCMessage } from '../../types';

function createMockConnections() {
  return {
    sendTo: vi.fn(),
    broadcastToAll: vi.fn(),
  } as unknown as ConnectionManager;
}

const mockBridge = {} as Bridge;

describe('restartBackendHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null | undefined) => {
      return undefined as never;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should send ACK with requestId before exiting', () => {
    const connections = createMockConnections();
    const message: IPCMessage = {
      type: 'RESTART_BACKEND',
      payload: {},
      timestamp: 0,
      requestId: 'req-restart-1',
    };

    restartBackendHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', {
      requestId: 'req-restart-1',
    });
  });

  it('should call process.exit(75) after ~300ms', () => {
    const connections = createMockConnections();
    const message: IPCMessage = {
      type: 'RESTART_BACKEND',
      payload: {},
      timestamp: 0,
      requestId: 'req-restart-2',
    };

    restartBackendHandler('conn-1', message, connections, mockBridge);

    // process.exit should not have been called yet
    expect(process.exit).not.toHaveBeenCalled();

    // Advance time by 300ms
    vi.advanceTimersByTime(300);

    expect(process.exit).toHaveBeenCalledWith(75);
  });

  it('should send ACK before process.exit is scheduled', () => {
    const connections = createMockConnections();
    const message: IPCMessage = {
      type: 'RESTART_BACKEND',
      payload: {},
      timestamp: 0,
      requestId: 'req-restart-3',
    };

    restartBackendHandler('conn-1', message, connections, mockBridge);

    // ACK must be sent synchronously, before timer fires
    expect(connections.sendTo).toHaveBeenCalledTimes(1);
    expect(process.exit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(process.exit).toHaveBeenCalledTimes(1);
    expect(connections.sendTo).toHaveBeenCalledTimes(1);
  });

  it('should not call process.exit before 300ms elapses', () => {
    const connections = createMockConnections();
    const message: IPCMessage = {
      type: 'RESTART_BACKEND',
      payload: {},
      timestamp: 0,
      requestId: 'req-restart-4',
    };

    restartBackendHandler('conn-1', message, connections, mockBridge);

    vi.advanceTimersByTime(299);
    expect(process.exit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(process.exit).toHaveBeenCalledWith(75);
  });
});
