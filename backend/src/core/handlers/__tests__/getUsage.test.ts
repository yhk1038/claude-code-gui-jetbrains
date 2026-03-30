import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'child_process';
import { getUsageHandler, resetUsageCache } from '../getUsage';

const mockExecFile = vi.mocked(execFile);
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

const SAMPLE_USAGE = {
  five_hour: { utilization: 49, resets_at: '2026-03-30T11:00:00Z' },
  seven_day: { utilization: 8, resets_at: '2026-04-05T03:00:00Z' },
  seven_day_oauth_apps: null,
  seven_day_opus: null,
  seven_day_sonnet: { utilization: 3, resets_at: '2026-04-06T04:00:00Z' },
  seven_day_cowork: null,
  iguana_necktie: null,
  extra_usage: { is_enabled: false, monthly_limit: null, used_credits: null, utilization: null },
};

function setupExecFileSuccess(data: unknown) {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, callback: Function) => {
    callback(null, JSON.stringify(data), '');
  });
}

function setupExecFileError(err: Error) {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, callback: Function) => {
    callback(err);
  });
}

function setupExecFileStdout(stdout: string) {
  mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, callback: Function) => {
    callback(null, stdout, '');
  });
}

describe('getUsageHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUsageCache();
  });

  it('should return usage data on successful ccb execution', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
    setupExecFileSuccess(SAMPLE_USAGE);

    await getUsageHandler('conn-1', message, connections, mockBridge);

    expect(mockExecFile).toHaveBeenCalledWith(
      'npx',
      ['ccb', 'oauth', 'usage', '--json'],
      expect.objectContaining({ timeout: 15000 }),
      expect.any(Function),
    );
    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', {
      requestId: 'req-1',
      status: 'ok',
      usage: SAMPLE_USAGE,
    });
  });

  it('should return cached data on second call within TTL', async () => {
    const connections = createMockConnections();
    const message1: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
    const message2: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-2' };
    setupExecFileSuccess(SAMPLE_USAGE);

    await getUsageHandler('conn-1', message1, connections, mockBridge);
    await getUsageHandler('conn-1', message2, connections, mockBridge);

    expect(mockExecFile).toHaveBeenCalledTimes(1);
    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', {
      requestId: 'req-2',
      status: 'ok',
      usage: SAMPLE_USAGE,
    });
  });

  it('should return error when ccb execution fails', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
    setupExecFileError(new Error('ccb: command not found'));

    await getUsageHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
      requestId: 'req-1',
      status: 'error',
    }));
  });

  it('should return error when ccb returns empty stdout', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
    setupExecFileStdout('');

    await getUsageHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
      requestId: 'req-1',
      status: 'error',
    }));
  });

  it('should return error when ccb returns invalid JSON', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
    setupExecFileStdout('not valid json {{{');

    await getUsageHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
      requestId: 'req-1',
      status: 'error',
    }));
  });
});
