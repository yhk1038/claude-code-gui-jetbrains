import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock BEFORE import
vi.mock('../../claude', () => ({
  Claude: {
    execAuthed: vi.fn(),
  },
}));

import { getAccountHandler } from '../getAccount';
import { Claude } from '../../claude';
import type { ConnectionManager } from '../../../ws/connection-manager';
import type { Bridge } from '../../../bridge/bridge-interface';
import type { IPCMessage } from '../../types';
import { MessageType } from '../../../shared';

const mockExec = vi.mocked(Claude.execAuthed);

function createMockConnections() {
  return {
    sendTo: vi.fn(),
    broadcastToAll: vi.fn(),
  } as unknown as ConnectionManager;
}

const mockBridge = {} as Bridge;

const validAccountPayload = {
  loggedIn: true,
  authMethod: 'claude.ai',
  email: 'user@example.com',
  subscriptionType: 'Pro',
  orgId: 'org-123',
  orgName: 'My Org',
};

describe('getAccountHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send ACK with status ok and parsed account on success', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = { type: MessageType.GET_ACCOUNT, payload: {}, timestamp: 0, requestId: 'req-1' };

    mockExec.mockResolvedValue({
      stdout: JSON.stringify(validAccountPayload),
      stderr: '',
    });

    await getAccountHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', MessageType.ACK, expect.objectContaining({
      requestId: 'req-1',
      status: 'ok',
      account: validAccountPayload,
    }));
  });

  it('should send ACK with status error when stdout is empty', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = { type: MessageType.GET_ACCOUNT, payload: {}, timestamp: 0, requestId: 'req-1' };

    mockExec.mockResolvedValue({
      stdout: '',
      stderr: '',
    });

    await getAccountHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', MessageType.ACK, expect.objectContaining({
      requestId: 'req-1',
      status: 'error',
      error: 'Claude Code credentials not found. Please log in with Claude Code CLI first.',
    }));
  });

  it('should send ACK with status error when Claude.execAuthed throws', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = { type: MessageType.GET_ACCOUNT, payload: {}, timestamp: 0, requestId: 'req-1' };

    mockExec.mockRejectedValue(new Error('spawn error'));

    await getAccountHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', MessageType.ACK, expect.objectContaining({
      requestId: 'req-1',
      status: 'error',
      error: 'Claude Code credentials not found. Please log in with Claude Code CLI first.',
    }));
  });

  it('should call Claude.execAuthed with auth status args, workingDir, and timeout 8000', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = { type: MessageType.GET_ACCOUNT, payload: {}, timestamp: 0, requestId: 'req-1' };

    mockExec.mockResolvedValue({
      stdout: JSON.stringify(validAccountPayload),
      stderr: '',
    });

    await getAccountHandler('conn-1', message, connections, mockBridge);

    // execAuthed(args, workingDir, options) — no workingDir in this payload → undefined.
    expect(mockExec).toHaveBeenCalledWith(['auth', 'status'], undefined, { timeout: 8000 });
  });
});
