import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'child_process';
import { getUsageHandler, resetUsageCache, shellInvocation } from '../getUsage';

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

type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;

function setupExecFileSuccess(data: unknown) {
  mockExecFile.mockImplementation(((_cmd: string, _args: readonly string[] | null | undefined, _opts: unknown, callback: ExecFileCallback) => {
    callback(null, JSON.stringify(data), '');
  }) as unknown as typeof execFile);
}

function setupExecFileError(err: Error) {
  mockExecFile.mockImplementation(((_cmd: string, _args: readonly string[] | null | undefined, _opts: unknown, callback: ExecFileCallback) => {
    callback(err, '', '');
  }) as unknown as typeof execFile);
}

function setupExecFileStdout(stdout: string) {
  mockExecFile.mockImplementation(((_cmd: string, _args: readonly string[] | null | undefined, _opts: unknown, callback: ExecFileCallback) => {
    callback(null, stdout, '');
  }) as unknown as typeof execFile);
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

    const expectedShellArgs = process.platform === 'win32'
      ? ['/c', 'ccb oauth usage --json']
      : ['-l', '-i', '-c', 'ccb oauth usage --json'];
    expect(mockExecFile).toHaveBeenCalledWith(
      expect.any(String),
      expectedShellArgs,
      expect.objectContaining({ timeout: 15000 }),
      expect.any(Function),
    );
    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', {
      requestId: 'req-1',
      status: 'ok',
      usage: SAMPLE_USAGE,
    });
  });

  it('should not include error_kind on successful response', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
    setupExecFileSuccess(SAMPLE_USAGE);

    await getUsageHandler('conn-1', message, connections, mockBridge);

    const call = (connections.sendTo as ReturnType<typeof vi.fn>).mock.calls[0];
    const payload = call[2];
    expect(payload.error_kind).toBeUndefined();
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

  describe('error classification', () => {
    it('should classify "ccb: command not found" as ccb_missing', async () => {
      const connections = createMockConnections();
      const message: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
      setupExecFileError(new Error('ccb: command not found'));

      await getUsageHandler('conn-1', message, connections, mockBridge);

      expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
        requestId: 'req-1',
        status: 'error',
        error_kind: 'ccb_missing',
        error: 'claude-code-battery CLI is not installed',
      }));
    });

    it('should classify ENOENT (spawn failure) as ccb_missing', async () => {
      const connections = createMockConnections();
      const message: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
      const enoentErr = Object.assign(new Error('spawn ccb ENOENT'), { code: 'ENOENT' });
      setupExecFileError(enoentErr);

      await getUsageHandler('conn-1', message, connections, mockBridge);

      expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
        requestId: 'req-1',
        status: 'error',
        error_kind: 'ccb_missing',
        error: 'claude-code-battery CLI is not installed',
      }));
    });

    it('should classify npm "could not determine executable" as ccb_missing', async () => {
      const connections = createMockConnections();
      const message: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
      setupExecFileError(new Error(
        'Command failed: npx ccb oauth usage --json\nnpm error could not determine executable to run\nnpm error A complete log of this run can be found in: /tmp/npm.log',
      ));

      await getUsageHandler('conn-1', message, connections, mockBridge);

      expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
        requestId: 'req-1',
        status: 'error',
        error_kind: 'ccb_missing',
        error: 'claude-code-battery CLI is not installed',
      }));
    });

    it('should classify "npm: command not found" as npm_missing', async () => {
      const connections = createMockConnections();
      const message: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
      setupExecFileError(new Error('npm: command not found'));

      await getUsageHandler('conn-1', message, connections, mockBridge);

      expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
        requestId: 'req-1',
        status: 'error',
        error_kind: 'npm_missing',
      }));
    });

    it('should classify auth error from JSON in error message', async () => {
      const connections = createMockConnections();
      const message: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
      setupExecFileError(new Error(
        'Command failed: npx ccb oauth usage --json\n{"error":{"message":"OAuth token expired"}}',
      ));

      await getUsageHandler('conn-1', message, connections, mockBridge);

      expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
        requestId: 'req-1',
        status: 'error',
        error_kind: 'auth',
        error: 'OAuth token expired',
      }));
    });

    it('should classify ENOTFOUND as network error', async () => {
      const connections = createMockConnections();
      const message: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
      setupExecFileError(new Error('getaddrinfo ENOTFOUND api.anthropic.com'));

      await getUsageHandler('conn-1', message, connections, mockBridge);

      expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
        requestId: 'req-1',
        status: 'error',
        error_kind: 'network',
      }));
    });

    it('should classify unknown errors as unknown', async () => {
      const connections = createMockConnections();
      const message: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
      setupExecFileError(new Error('something weird happened'));

      await getUsageHandler('conn-1', message, connections, mockBridge);

      expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
        requestId: 'req-1',
        status: 'error',
        error_kind: 'unknown',
        error: 'something weird happened',
      }));
    });
  });

  it('should return error when ccb returns empty stdout', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
    setupExecFileStdout('');

    await getUsageHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
      requestId: 'req-1',
      status: 'error',
      error_kind: expect.any(String),
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
      error_kind: expect.any(String),
    }));
  });

  // Issue #62: Linux .bashrc often emits printf "\e[?2004l" (disable bracketed paste).
  // Under `bash -l -i -c`, this escape sequence is written to stdout before the JSON,
  // and trim() cannot strip the ESC control char, so JSON.parse fails.
  it('should parse JSON despite a leading bracketed-paste escape sequence (issue #62)', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
    setupExecFileStdout(`\x1b[?2004l${JSON.stringify(SAMPLE_USAGE)}`);

    await getUsageHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', {
      requestId: 'req-1',
      status: 'ok',
      usage: SAMPLE_USAGE,
    });
  });

  it('should parse JSON despite surrounding shell noise on stdout', async () => {
    const connections = createMockConnections();
    const message: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
    setupExecFileStdout(`\x1b[?2004l\n${JSON.stringify(SAMPLE_USAGE)}\n\x1b[?2004h`);

    await getUsageHandler('conn-1', message, connections, mockBridge);

    expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', {
      requestId: 'req-1',
      status: 'ok',
      usage: SAMPLE_USAGE,
    });
  });

  describe('shellInvocation', () => {
    const originalPlatform = process.platform;
    const originalShell = process.env.SHELL;
    const originalComSpec = process.env.ComSpec;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      if (originalShell === undefined) {
        delete process.env.SHELL;
      } else {
        process.env.SHELL = originalShell;
      }
      if (originalComSpec === undefined) {
        delete process.env.ComSpec;
      } else {
        process.env.ComSpec = originalComSpec;
      }
    });

    it('falls back to /bin/sh when SHELL is /usr/bin/fish', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      process.env.SHELL = '/usr/bin/fish';

      const result = shellInvocation('ccb oauth usage --json');

      expect(result.shell).toBe('/bin/sh');
      expect(result.args).toEqual(['-l', '-i', '-c', 'ccb oauth usage --json']);
    });

    it('falls back to /bin/sh when SHELL is /opt/homebrew/bin/fish', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      process.env.SHELL = '/opt/homebrew/bin/fish';

      const result = shellInvocation('ccb oauth usage --json');

      expect(result.shell).toBe('/bin/sh');
      expect(result.args).toEqual(['-l', '-i', '-c', 'ccb oauth usage --json']);
    });

    it('uses SHELL as-is when SHELL is /bin/zsh', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      process.env.SHELL = '/bin/zsh';

      const result = shellInvocation('ccb oauth usage --json');

      expect(result.shell).toBe('/bin/zsh');
      expect(result.args).toEqual(['-l', '-i', '-c', 'ccb oauth usage --json']);
    });

    it('uses SHELL as-is when SHELL is /bin/bash', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      process.env.SHELL = '/bin/bash';

      const result = shellInvocation('ccb oauth usage --json');

      expect(result.shell).toBe('/bin/bash');
      expect(result.args).toEqual(['-l', '-i', '-c', 'ccb oauth usage --json']);
    });

    it('uses ComSpec (or cmd.exe) on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      process.env.ComSpec = 'C:\\Windows\\System32\\cmd.exe';

      const result = shellInvocation('ccb oauth usage --json');

      expect(result.shell).toBe('C:\\Windows\\System32\\cmd.exe');
      expect(result.args).toEqual(['/c', 'ccb oauth usage --json']);
    });

    it('falls back to cmd.exe when ComSpec is unset on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      delete process.env.ComSpec;

      const result = shellInvocation('ccb oauth usage --json');

      expect(result.shell).toBe('cmd.exe');
      expect(result.args).toEqual(['/c', 'ccb oauth usage --json']);
    });
  });

  describe('force refresh', () => {
    it('force=true bypasses successful cache', async () => {
      const connections = createMockConnections();
      const message1: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
      const message2: IPCMessage = { type: 'GET_USAGE', payload: { force: true }, timestamp: 0, requestId: 'req-2' };
      setupExecFileSuccess(SAMPLE_USAGE);

      await getUsageHandler('conn-1', message1, connections, mockBridge);
      expect(mockExecFile).toHaveBeenCalledTimes(1);

      await getUsageHandler('conn-1', message2, connections, mockBridge);
      expect(mockExecFile).toHaveBeenCalledTimes(2);

      expect(connections.sendTo).toHaveBeenLastCalledWith('conn-1', 'ACK', {
        requestId: 'req-2',
        status: 'ok',
        usage: SAMPLE_USAGE,
      });
    });

    it('force=true bypasses error cache and returns fresh success', async () => {
      const connections = createMockConnections();
      const message1: IPCMessage = { type: 'GET_USAGE', payload: {}, timestamp: 0, requestId: 'req-1' };
      const message2: IPCMessage = { type: 'GET_USAGE', payload: { force: true }, timestamp: 0, requestId: 'req-2' };

      setupExecFileError(new Error('ccb: command not found'));
      await getUsageHandler('conn-1', message1, connections, mockBridge);
      expect(connections.sendTo).toHaveBeenCalledWith('conn-1', 'ACK', expect.objectContaining({
        status: 'error',
        error_kind: 'ccb_missing',
      }));

      setupExecFileSuccess(SAMPLE_USAGE);
      await getUsageHandler('conn-1', message2, connections, mockBridge);
      expect(mockExecFile).toHaveBeenCalledTimes(2);
      expect(connections.sendTo).toHaveBeenLastCalledWith('conn-1', 'ACK', {
        requestId: 'req-2',
        status: 'ok',
        usage: SAMPLE_USAGE,
      });
    });

    // Note: force=true bypasses inflight test omitted — requires deferred callback mocking
    // which adds complexity not warranted for this case. The implementation resets
    // inflightPromise = null before running a force execution.
  });
});
