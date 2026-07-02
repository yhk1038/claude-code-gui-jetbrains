import { describe, it, expect } from 'vitest';
import {
  detectPackageManager,
  detectHomebrewCask,
  updateModeFor,
  isNewerVersion,
  isCliUpdatable,
  parseDistTags,
  buildUpdateCommand,
  CLAUDE_NPM_PACKAGE,
} from '../cli-update';
import { PackageManager, UpdateMode } from '../../shared';

const HOME = '/Users/dev';

describe('detectPackageManager', () => {
  it('detects volta from the shim path', () => {
    expect(detectPackageManager(['/Users/dev/.volta/bin/claude', '/Users/dev/.volta/bin/volta-shim'], HOME))
      .toBe(PackageManager.VOLTA);
  });

  it('detects npm from a /usr/local symlink that realpaths into node_modules', () => {
    expect(detectPackageManager(
      ['/usr/local/bin/claude', '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js'],
      HOME,
    )).toBe(PackageManager.NPM);
  });

  it('detects npm via an nvm bin path', () => {
    expect(detectPackageManager(['/Users/dev/.nvm/versions/node/v20.11.0/bin/claude'], HOME))
      .toBe(PackageManager.NPM);
  });

  it('detects pnpm even when its store lives under ~/.local', () => {
    expect(detectPackageManager(['/Users/dev/.local/share/pnpm/claude'], HOME))
      .toBe(PackageManager.PNPM);
  });

  it('detects the native installer under ~/.local/bin', () => {
    expect(detectPackageManager(['/Users/dev/.local/bin/claude'], HOME))
      .toBe(PackageManager.NATIVE);
  });

  it('detects homebrew from a Cellar/Caskroom path', () => {
    expect(detectPackageManager(['/opt/homebrew/bin/claude', '/opt/homebrew/Caskroom/claude-code/2.1.0/claude'], HOME))
      .toBe(PackageManager.HOMEBREW);
  });

  it('detects winget on Windows', () => {
    expect(detectPackageManager(
      ['C:\\Users\\dev\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Anthropic.ClaudeCode_x\\claude.exe'],
      'C:\\Users\\dev',
      'win32',
    )).toBe(PackageManager.WINGET);
  });

  it('detects npm from the Windows AppData\\Roaming\\npm path', () => {
    expect(detectPackageManager(
      ['C:\\Users\\dev\\AppData\\Roaming\\npm\\claude.cmd'],
      'C:\\Users\\dev',
      'win32',
    )).toBe(PackageManager.NPM);
  });

  it('returns UNKNOWN for a /usr/bin system path', () => {
    expect(detectPackageManager(['/usr/bin/claude'], HOME)).toBe(PackageManager.UNKNOWN);
  });

  it('returns UNKNOWN when no path resolves', () => {
    expect(detectPackageManager([null, undefined, ''], HOME)).toBe(PackageManager.UNKNOWN);
  });
});

describe('detectHomebrewCask', () => {
  it('defaults to the stable claude-code cask', () => {
    expect(detectHomebrewCask(['/opt/homebrew/Caskroom/claude-code/2.1.0/claude'])).toBe('claude-code');
  });
  it('detects the @latest cask from the Caskroom path', () => {
    expect(detectHomebrewCask(['/opt/homebrew/bin/claude', '/opt/homebrew/Caskroom/claude-code@latest/2.1.5/claude']))
      .toBe('claude-code@latest');
  });
});

describe('updateModeFor', () => {
  it('maps node PMs to VERSIONED', () => {
    for (const pm of [PackageManager.NPM, PackageManager.PNPM, PackageManager.YARN, PackageManager.VOLTA]) {
      expect(updateModeFor(pm)).toBe(UpdateMode.VERSIONED);
    }
  });
  it('maps native/homebrew/winget to SIMPLE', () => {
    for (const pm of [PackageManager.NATIVE, PackageManager.HOMEBREW, PackageManager.WINGET]) {
      expect(updateModeFor(pm)).toBe(UpdateMode.SIMPLE);
    }
  });
  it('maps UNKNOWN to NONE', () => {
    expect(updateModeFor(PackageManager.UNKNOWN)).toBe(UpdateMode.NONE);
  });
});

describe('isNewerVersion', () => {
  it('compares semver components numerically', () => {
    expect(isNewerVersion('2.1.197', '2.1.179')).toBe(true);
    expect(isNewerVersion('2.1.179', '2.1.197')).toBe(false);
    expect(isNewerVersion('2.1.179', '2.1.179')).toBe(false);
    expect(isNewerVersion('2.2.0', '2.1.999')).toBe(true);
  });
  it('does not treat 2.1.9 as newer than 2.1.10', () => {
    expect(isNewerVersion('2.1.9', '2.1.10')).toBe(false);
    expect(isNewerVersion('2.1.10', '2.1.9')).toBe(true);
  });
});

describe('isCliUpdatable', () => {
  it('is false when mode is NONE', () => {
    expect(isCliUpdatable(UpdateMode.NONE, '2.1.0', '2.1.5')).toBe(false);
  });
  it('is false when a version is missing', () => {
    expect(isCliUpdatable(UpdateMode.SIMPLE, null, '2.1.5')).toBe(false);
    expect(isCliUpdatable(UpdateMode.SIMPLE, '2.1.0', null)).toBe(false);
  });
  it('is true when a newer version exists and mode allows it', () => {
    expect(isCliUpdatable(UpdateMode.VERSIONED, '2.1.0', '2.1.5')).toBe(true);
    expect(isCliUpdatable(UpdateMode.SIMPLE, '2.1.5', '2.1.5')).toBe(false);
  });
});

describe('parseDistTags', () => {
  it('extracts stable and latest', () => {
    expect(parseDistTags('{"stable":"2.1.185","latest":"2.1.197","next":"2.1.197"}'))
      .toEqual({ stable: '2.1.185', latest: '2.1.197' });
  });
  it('returns nulls on malformed json', () => {
    expect(parseDistTags('not json')).toEqual({ stable: null, latest: null });
  });
  it('returns null for missing tags', () => {
    expect(parseDistTags('{"latest":"2.1.197"}')).toEqual({ stable: null, latest: '2.1.197' });
  });
});

describe('buildUpdateCommand', () => {
  it('builds a versioned npm command', () => {
    expect(buildUpdateCommand(PackageManager.NPM, '2.1.185'))
      .toEqual({ command: 'npm', args: ['install', '-g', `${CLAUDE_NPM_PACKAGE}@2.1.185`] });
  });
  it('builds a versioned volta command', () => {
    expect(buildUpdateCommand(PackageManager.VOLTA, '2.1.185'))
      .toEqual({ command: 'volta', args: ['install', `${CLAUDE_NPM_PACKAGE}@2.1.185`] });
  });
  it('builds pnpm and yarn commands', () => {
    expect(buildUpdateCommand(PackageManager.PNPM, '2.1.185')?.args).toEqual(['add', '-g', `${CLAUDE_NPM_PACKAGE}@2.1.185`]);
    expect(buildUpdateCommand(PackageManager.YARN, '2.1.185')?.args).toEqual(['global', 'add', `${CLAUDE_NPM_PACKAGE}@2.1.185`]);
  });
  it('native ignores the version and runs claude update', () => {
    expect(buildUpdateCommand(PackageManager.NATIVE, '2.1.185'))
      .toEqual({ command: 'claude', args: ['update'] });
  });
  it('homebrew targets the given cask', () => {
    expect(buildUpdateCommand(PackageManager.HOMEBREW, null, 'claude-code@latest'))
      .toEqual({ command: 'brew', args: ['upgrade', 'claude-code@latest'] });
  });
  it('winget upgrades the pinned package id', () => {
    expect(buildUpdateCommand(PackageManager.WINGET, null))
      .toEqual({ command: 'winget', args: ['upgrade', '--id', 'Anthropic.ClaudeCode', '-e'] });
  });
  it('returns null for UNKNOWN', () => {
    expect(buildUpdateCommand(PackageManager.UNKNOWN, '2.1.0')).toBeNull();
  });
});
