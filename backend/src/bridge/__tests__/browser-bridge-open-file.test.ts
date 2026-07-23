import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb?: (err: Error | null) => void) => {
    cb?.(null);
  }),
  spawn: vi.fn(() => ({ unref: vi.fn() })),
}));

vi.mock('../../core/features/settings', () => ({
  readSettingsFile: vi.fn(),
}));

import { execFile, spawn } from 'child_process';
import { readSettingsFile } from '../../core/features/settings';
import { BrowserBridge } from '../browser-bridge';

describe('BrowserBridge.openFile — openFilesWith setting', () => {
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });

  function setPlatform(platform: NodeJS.Platform) {
    Object.defineProperty(process, 'platform', { value: platform });
  }

  it('launches the configured editor via execFile -a on macOS when openFilesWith is set', async () => {
    setPlatform('darwin');
    vi.mocked(readSettingsFile).mockResolvedValue({ openFilesWith: 'Cursor' });

    const bridge = new BrowserBridge();
    await bridge.openFile('/tmp/file.ts');

    expect(execFile).toHaveBeenCalledWith('open', ['-a', 'Cursor', '/tmp/file.ts'], expect.any(Function));
  });

  it('launches the configured editor via execFile directly on linux when openFilesWith is set', async () => {
    setPlatform('linux');
    vi.mocked(readSettingsFile).mockResolvedValue({ openFilesWith: 'code' });

    const bridge = new BrowserBridge();
    await bridge.openFile('/tmp/file.ts');

    expect(execFile).toHaveBeenCalledWith('code', ['/tmp/file.ts'], expect.any(Function));
  });

  it('launches the configured editor via spawn on windows when openFilesWith is set', async () => {
    setPlatform('win32');
    vi.mocked(readSettingsFile).mockResolvedValue({ openFilesWith: 'code' });

    const bridge = new BrowserBridge();
    await bridge.openFile('C:\\tmp\\file.ts');

    expect(spawn).toHaveBeenCalledWith('code', ['C:\\tmp\\file.ts'], expect.objectContaining({
      stdio: 'ignore',
      detached: true,
    }));
  });

  it('falls back to the OS default opener when openFilesWith is null', async () => {
    setPlatform('darwin');
    vi.mocked(readSettingsFile).mockResolvedValue({ openFilesWith: null });

    const bridge = new BrowserBridge();
    await bridge.openFile('/tmp/file.ts');

    expect(execFile).toHaveBeenCalledWith('open', ['/tmp/file.ts'], expect.any(Function));
  });
});
