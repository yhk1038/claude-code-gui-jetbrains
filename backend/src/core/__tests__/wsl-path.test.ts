import { describe, it, expect } from 'vitest';
import { isWslUncPath } from '../wsl-path';

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
