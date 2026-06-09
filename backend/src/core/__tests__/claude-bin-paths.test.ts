import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { candidateBinDirs } from '../claude-bin-paths';

describe('candidateBinDirs', () => {
  const home = '/Users/me';

  it('returns [] when no home directory can be determined', () => {
    expect(candidateBinDirs({}, 'darwin')).toEqual([]);
  });

  it('includes the claude migrate-installer location (~/.claude/local)', () => {
    const dirs = candidateBinDirs({ HOME: home }, 'darwin');
    expect(dirs).toContain(join(home, '.claude', 'local'));
  });

  it('ranks ~/.claude/local ahead of ~/.local/bin', () => {
    const dirs = candidateBinDirs({ HOME: home }, 'darwin');
    expect(dirs.indexOf(join(home, '.claude', 'local')))
      .toBeLessThan(dirs.indexOf(join(home, '.local', 'bin')));
  });

  it('includes the common manager bin dirs on macOS', () => {
    const dirs = candidateBinDirs({ HOME: home }, 'darwin');
    expect(dirs).toEqual(
      expect.arrayContaining([
        join(home, '.local', 'bin'),
        join(home, '.npm-global', 'bin'),
        join(home, '.volta', 'bin'),
        join(home, '.fnm', 'aliases', 'default', 'bin'),
        '/usr/local/bin',
        '/opt/homebrew/bin',
      ]),
    );
  });

  it('does not include unix-only dirs on Windows', () => {
    const dirs = candidateBinDirs({ HOME: home }, 'win32');
    expect(dirs).not.toContain('/usr/local/bin');
    expect(dirs).not.toContain('/opt/homebrew/bin');
  });

  it('includes Windows bin dirs and still includes ~/.claude/local', () => {
    const dirs = candidateBinDirs(
      { HOME: home, APPDATA: 'C:\\Users\\me\\AppData\\Roaming', LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' },
      'win32',
    );
    expect(dirs).toContain(join(home, '.claude', 'local'));
    expect(dirs).toContain(join('C:\\Users\\me\\AppData\\Roaming', 'npm'));
    expect(dirs).toContain(join('C:\\Users\\me\\AppData\\Local', 'Volta', 'bin'));
    expect(dirs).toContain(join(home, 'scoop', 'shims'));
  });

  it('falls back to USERPROFILE when HOME is absent', () => {
    const dirs = candidateBinDirs({ USERPROFILE: home }, 'darwin');
    expect(dirs).toContain(join(home, '.claude', 'local'));
  });
});
