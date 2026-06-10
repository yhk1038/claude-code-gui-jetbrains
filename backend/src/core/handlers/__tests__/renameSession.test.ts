import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('../../features/getProjectSessionsPath', () => ({
  getProjectSessionsPath: vi.fn(),
}));

vi.mock('../../features/sessionTitleOverrides', () => ({
  writeSessionTitleOverride: vi.fn(),
}));

import { existsSync } from 'fs';
import { renameSessionHandler } from '../renameSession';
import { getProjectSessionsPath } from '../../features/getProjectSessionsPath';
import { writeSessionTitleOverride } from '../../features/sessionTitleOverrides';
import type { ConnectionManager } from '../../../ws/connection-manager';
import type { Bridge } from '../../../bridge/bridge-interface';
import type { IPCMessage } from '../../types';

const mockExistsSync = vi.mocked(existsSync);
const mockGetPath = vi.mocked(getProjectSessionsPath);
const mockWriteOverride = vi.mocked(writeSessionTitleOverride);

function createMockConnections() {
  return {
    sendTo: vi.fn(),
    broadcastToAll: vi.fn(),
  } as unknown as ConnectionManager;
}

const mockBridge = {} as Bridge;

describe('renameSessionHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPath.mockResolvedValue('/home/user/.claude/projects/-test');
    mockExistsSync.mockReturnValue(true);
  });

  it('returns an error when sessionId is missing', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = {
      type: 'RENAME_SESSION',
      payload: { title: 'New', workingDir: '/test' },
      timestamp: 0,
      requestId: 'req-1',
    };

    await renameSessionHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
      status: 'error',
    }));
    expect(mockWriteOverride).not.toHaveBeenCalled();
  });

  it('returns an error when title is missing or blank', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = {
      type: 'RENAME_SESSION',
      payload: { sessionId: 'abc123', title: '   ', workingDir: '/test' },
      timestamp: 0,
      requestId: 'req-1',
    };

    await renameSessionHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
      status: 'error',
    }));
    expect(mockWriteOverride).not.toHaveBeenCalled();
  });

  it('returns an error when workingDir is missing', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = {
      type: 'RENAME_SESSION',
      payload: { sessionId: 'abc123', title: 'New' },
      timestamp: 0,
      requestId: 'req-1',
    };

    await renameSessionHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
      status: 'error',
    }));
    expect(mockWriteOverride).not.toHaveBeenCalled();
  });

  it('rejects path traversal with .. in sessionId', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = {
      type: 'RENAME_SESSION',
      payload: { sessionId: '../../../etc/passwd', title: 'New', workingDir: '/test' },
      timestamp: 0,
      requestId: 'req-1',
    };

    await renameSessionHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
      status: 'error',
      error: 'Invalid sessionId',
    }));
    expect(mockWriteOverride).not.toHaveBeenCalled();
  });

  it('rejects sessionId with a path separator', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = {
      type: 'RENAME_SESSION',
      payload: { sessionId: 'subdir/file', title: 'New', workingDir: '/test' },
      timestamp: 0,
      requestId: 'req-1',
    };

    await renameSessionHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
      status: 'error',
      error: 'Invalid sessionId',
    }));
    expect(mockWriteOverride).not.toHaveBeenCalled();
  });

  it('returns an error when the session file does not exist', async () => {
    const connections = createMockConnections();
    mockExistsSync.mockReturnValue(false);
    const message: IPCMessage = {
      type: 'RENAME_SESSION',
      payload: { sessionId: 'abc123', title: 'New', workingDir: '/test' },
      timestamp: 0,
      requestId: 'req-1',
    };

    await renameSessionHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
      status: 'error',
      error: 'Session not found',
    }));
    expect(mockWriteOverride).not.toHaveBeenCalled();
  });

  it('persists the title, broadcasts the rename, and acks ok for a valid request', async () => {
    const connections = createMockConnections();
    mockWriteOverride.mockResolvedValue(undefined);
    const message: IPCMessage = {
      type: 'RENAME_SESSION',
      payload: { sessionId: 'abc123', title: '  My Renamed Session  ', workingDir: '/test' },
      timestamp: 0,
      requestId: 'req-1',
    };

    await renameSessionHandler('conn-1', message, connections, mockBridge);

    expect(mockWriteOverride).toHaveBeenCalledWith(
      '/home/user/.claude/projects/-test',
      'abc123',
      'My Renamed Session',
    );
    expect(connections.broadcastToAll).toHaveBeenCalledWith('SESSIONS_UPDATED', {
      action: 'rename',
      session: { sessionId: 'abc123', title: 'My Renamed Session' },
    });
    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
      status: 'ok',
    }));
  });

  it('returns an error when persistence throws', async () => {
    const connections = createMockConnections();
    mockWriteOverride.mockRejectedValue(new Error('disk full'));
    const message: IPCMessage = {
      type: 'RENAME_SESSION',
      payload: { sessionId: 'abc123', title: 'New', workingDir: '/test' },
      timestamp: 0,
      requestId: 'req-1',
    };

    await renameSessionHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
      status: 'error',
      error: 'disk full',
    }));
  });
});
