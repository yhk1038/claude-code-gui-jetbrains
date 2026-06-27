import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../features/settings', () => ({
  saveEnvVarToScope: vi.fn(),
  readMergedSettings: vi.fn(),
}));
vi.mock('../../claude', () => ({
  Claude: { applyConfigDir: vi.fn() },
}));

import { saveClaudeConfigDirHandler } from '../saveClaudeConfigDir';
import { saveEnvVarToScope, readMergedSettings } from '../../features/settings';
import { Claude } from '../../claude';
import { MessageType } from '../../../shared';
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

describe('saveClaudeConfigDirHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readMergedSettings).mockResolvedValue({ settings: {}, overrides: [] });
  });

  it('saves the value to file, applies it to the current workingDir, and broadcasts', async () => {
    const connections = createMockConnections();
    vi.mocked(saveEnvVarToScope).mockResolvedValue({ status: 'ok' });

    const message: IPCMessage = {
      type: MessageType.SAVE_CLAUDE_CONFIG_DIR,
      payload: { value: '/home/u/.claude-work', scope: 'project', workingDir: '/proj' },
      timestamp: 0,
      requestId: 'req-1',
    };
    await saveClaudeConfigDirHandler('conn-1', message, connections, mockBridge);

    expect(saveEnvVarToScope).toHaveBeenCalledWith('CLAUDE_CONFIG_DIR', '/home/u/.claude-work', 'project', '/proj');
    expect(Claude.applyConfigDir).toHaveBeenCalledWith('/proj');
    expect(connections.broadcastToAll).toHaveBeenCalledWith(MessageType.SETTINGS_CHANGED, expect.any(Object));
    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', MessageType.ACK, expect.objectContaining({
      requestId: 'req-1',
      status: 'ok',
    }));
  });

  it('treats a blank value as removal (passes null)', async () => {
    const connections = createMockConnections();
    vi.mocked(saveEnvVarToScope).mockResolvedValue({ status: 'ok' });

    const message: IPCMessage = {
      type: MessageType.SAVE_CLAUDE_CONFIG_DIR,
      payload: { value: '   ', scope: 'global' },
      timestamp: 0,
      requestId: 'req-2',
    };
    await saveClaudeConfigDirHandler('conn-1', message, connections, mockBridge);

    expect(saveEnvVarToScope).toHaveBeenCalledWith('CLAUDE_CONFIG_DIR', null, 'global', undefined);
  });

  it('defaults scope to global when omitted', async () => {
    const connections = createMockConnections();
    vi.mocked(saveEnvVarToScope).mockResolvedValue({ status: 'ok' });

    const message: IPCMessage = {
      type: MessageType.SAVE_CLAUDE_CONFIG_DIR,
      payload: { value: '/x' },
      timestamp: 0,
      requestId: 'req-3',
    };
    await saveClaudeConfigDirHandler('conn-1', message, connections, mockBridge);

    expect(saveEnvVarToScope).toHaveBeenCalledWith('CLAUDE_CONFIG_DIR', '/x', 'global', undefined);
  });

  it('does not refresh or broadcast when the save fails', async () => {
    const connections = createMockConnections();
    vi.mocked(saveEnvVarToScope).mockResolvedValue({ status: 'error', error: 'disk full' });

    const message: IPCMessage = {
      type: MessageType.SAVE_CLAUDE_CONFIG_DIR,
      payload: { value: '/x', scope: 'global' },
      timestamp: 0,
      requestId: 'req-4',
    };
    await saveClaudeConfigDirHandler('conn-1', message, connections, mockBridge);

    expect(Claude.applyConfigDir).not.toHaveBeenCalled();
    expect(connections.broadcastToAll).not.toHaveBeenCalled();
    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', MessageType.ACK, expect.objectContaining({
      requestId: 'req-4',
      status: 'error',
      error: 'disk full',
    }));
  });
});
