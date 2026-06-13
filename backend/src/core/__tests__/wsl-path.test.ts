import { describe, it, expect } from 'vitest';
import { isWslUncPath, parseUncPath, toWslPath } from '../wsl-path';

describe('isWslUncPath', () => {
  it('recognizes the modern wsl.localhost prefix', () => {
    expect(isWslUncPath('\\\\wsl.localhost\\Ubuntu\\home\\user\\proj')).toBe(true);
  });

  it('recognizes the legacy wsl$ prefix', () => {
    expect(isWslUncPath('\\\\wsl$\\NixOS\\home\\maicol07')).toBe(true);
  });

  it('matches the host case-insensitively', () => {
    expect(isWslUncPath('\\\\WSL.LOCALHOST\\Ubuntu\\home')).toBe(true);
  });

  it('accepts already forward-slashed input', () => {
    expect(isWslUncPath('//wsl.localhost/Ubuntu/home')).toBe(true);
  });

  it('rejects native Windows and Linux paths', () => {
    expect(isWslUncPath('C:\\Users\\foo')).toBe(false);
    expect(isWslUncPath('/home/user/proj')).toBe(false);
    expect(isWslUncPath('\\\\some-server\\share')).toBe(false);
  });

  it('rejects null, undefined and empty', () => {
    expect(isWslUncPath(null)).toBe(false);
    expect(isWslUncPath(undefined)).toBe(false);
    expect(isWslUncPath('')).toBe(false);
  });
});

describe('parseUncPath', () => {
  it('extracts distro and linux path from the modern prefix', () => {
    expect(parseUncPath('\\\\wsl.localhost\\Ubuntu\\home\\user\\proj')).toEqual({
      distro: 'Ubuntu',
      linuxPath: '/home/user/proj',
    });
  });

  it('extracts distro and linux path from the legacy prefix', () => {
    expect(parseUncPath('\\\\wsl$\\NixOS\\home\\maicol07')).toEqual({
      distro: 'NixOS',
      linuxPath: '/home/maicol07',
    });
  });

  it('accepts already forward-slashed input', () => {
    expect(parseUncPath('//wsl.localhost/Ubuntu/home/yhk/test-proj')).toEqual({
      distro: 'Ubuntu',
      linuxPath: '/home/yhk/test-proj',
    });
  });

  it('preserves distro casing while matching host case-insensitively', () => {
    expect(parseUncPath('\\\\WSL.LOCALHOST\\Ubuntu-22.04\\srv\\app')).toEqual({
      distro: 'Ubuntu-22.04',
      linuxPath: '/srv/app',
    });
  });

  it('returns distro root when there is no inner path', () => {
    expect(parseUncPath('\\\\wsl.localhost\\Ubuntu')).toEqual({
      distro: 'Ubuntu',
      linuxPath: '/',
    });
  });

  it('returns null for non-wsl paths', () => {
    expect(parseUncPath('C:\\Users\\foo')).toBeNull();
    expect(parseUncPath('/home/user')).toBeNull();
    expect(parseUncPath(null)).toBeNull();
  });
});

describe('toWslPath', () => {
  it('converts a wsl unc path to the inner linux path', () => {
    expect(toWslPath('\\\\wsl.localhost\\Ubuntu\\home\\yhk\\test-proj')).toBe('/home/yhk/test-proj');
    expect(toWslPath('//wsl.localhost/Ubuntu/home/yhk/test-proj')).toBe('/home/yhk/test-proj');
    expect(toWslPath('\\\\wsl$\\NixOS\\home\\maicol07')).toBe('/home/maicol07');
  });

  it('converts a drive path to a /mnt path', () => {
    expect(toWslPath('C:\\Users\\foo\\bar')).toBe('/mnt/c/Users/foo/bar');
    expect(toWslPath('D:\\work')).toBe('/mnt/d/work');
    expect(toWslPath('C:\\')).toBe('/mnt/c');
  });

  it('leaves an existing linux path unchanged', () => {
    expect(toWslPath('/home/user/proj')).toBe('/home/user/proj');
  });

  it('passes null and blank through unchanged', () => {
    expect(toWslPath(null)).toBeNull();
    expect(toWslPath(undefined)).toBeUndefined();
    expect(toWslPath('')).toBe('');
  });
});
