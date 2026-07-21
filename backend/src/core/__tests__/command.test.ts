import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecFileException } from 'child_process';

// Mock child_process so we can inspect HOW Command invokes processes without
// spawning anything. execFileSync is stubbed because augmented-path may probe for
// nvm while building the env.
vi.mock('child_process', () => ({
  execFile: vi.fn(),
  spawn: vi.fn(() => ({ on: vi.fn(), pid: 1234 })),
  execFileSync: vi.fn(() => ''),
}));

import { execFile as cpExecFile, spawn as cpSpawn } from 'child_process';
import { Command, ShellKind } from '../command';

const mockExecFile = vi.mocked(cpExecFile);
const mockSpawn = vi.mocked(cpSpawn);
const isWin = process.platform === 'win32';

type ExecFileCb = (err: ExecFileException | null, stdout: string, stderr: string) => void;

/** A stubbed execFile that invokes its callback with the given result. */
function fakeExecFile(res: { stdout?: string; stderr?: string; err?: Error | null }) {
  return ((_file: string, _args: readonly string[], _opts: unknown, cb: ExecFileCb) => {
    cb((res.err ?? null) as ExecFileException | null, res.stdout ?? '', res.stderr ?? '');
    return { on: vi.fn() };
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Command', () => {
  it('exposes bin/args/options as constructed', () => {
    const c = new Command('npm', ['view', 'x'], { timeout: 1000 });
    expect(c.bin).toBe('npm');
    expect(c.args).toEqual(['view', 'x']);
    expect(c.options.timeout).toBe(1000);
  });

  describe('which()', () => {
    it.runIf(isWin)('win32: picks the PATHEXT launcher, skipping the extension-less script', async () => {
      mockExecFile.mockImplementation(fakeExecFile({ stdout: 'C:\\p\\ccb\r\nC:\\p\\ccb.cmd\r\n' }));
      const path = await new Command('ccb').which();
      expect(path).toBe('C:\\p\\ccb.cmd');
      const call = mockExecFile.mock.calls[0];
      expect(call[0]).toBe('where');
      expect(call[1]).toEqual(['ccb']);
    });

    it('returns null when the finder errors (binary not found)', async () => {
      mockExecFile.mockImplementation(fakeExecFile({ err: new Error('not found') }));
      expect(await new Command('nope').which()).toBeNull();
    });
  });

  describe('exec()', () => {
    it.runIf(isWin)('win32: runs through cmd.exe with the bin as an argv element', async () => {
      mockExecFile.mockImplementation(fakeExecFile({ stdout: 'OUT', stderr: 'ERR' }));
      const res = await new Command('npm', ['view', 'x']).exec();
      expect(res).toEqual({ stdout: 'OUT', stderr: 'ERR' });
      const call = mockExecFile.mock.calls[0];
      expect(String(call[0])).toMatch(/cmd\.exe$/i);
      expect(call[1]).toEqual(['/d', '/s', '/c', 'npm', 'view', 'x']);
    });

    it.runIf(!isWin)('unix Direct: runs the binary directly', async () => {
      mockExecFile.mockImplementation(fakeExecFile({ stdout: 'OUT' }));
      const res = await new Command('ccb', ['oauth', 'usage']).exec();
      expect(res.stdout).toBe('OUT');
      const call = mockExecFile.mock.calls[0];
      expect(call[0]).toBe('ccb');
      expect(call[1]).toEqual(['oauth', 'usage']);
    });

    it.runIf(!isWin)('unix LoginInteractive: wraps the command in $SHELL -l -i -c', async () => {
      mockExecFile.mockImplementation(fakeExecFile({ stdout: '{}' }));
      await new Command('ccb', ['oauth', 'usage', '--json'], { shell: ShellKind.LoginInteractive }).exec();
      const argv = mockExecFile.mock.calls[0][1] as string[];
      expect(argv.slice(0, 3)).toEqual(['-l', '-i', '-c']);
      expect(argv[3]).toBe('ccb oauth usage --json');
    });

    it.runIf(!isWin)('unix LoginInteractive: falls back to /bin/sh when SHELL is fish', async () => {
      const orig = process.env.SHELL;
      process.env.SHELL = '/usr/bin/fish';
      try {
        mockExecFile.mockImplementation(fakeExecFile({ stdout: '{}' }));
        await new Command('ccb', ['x'], { shell: ShellKind.LoginInteractive }).exec();
        expect(mockExecFile.mock.calls[0][0]).toBe('/bin/sh');
      } finally {
        if (orig === undefined) delete process.env.SHELL;
        else process.env.SHELL = orig;
      }
    });
  });

  describe('spawn()', () => {
    it('delegates to child_process.spawn with the given bin/args', () => {
      new Command('claude', ['-p', 'hi']).spawn();
      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const call = mockSpawn.mock.calls[0];
      expect(call[0]).toBe('claude');
      expect(call[1]).toEqual(['-p', 'hi']);
    });
  });
});
