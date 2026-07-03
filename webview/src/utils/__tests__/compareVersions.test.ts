import { describe, it, expect } from 'vitest';
import { compareVersions, isAtLeastVersion } from '../compareVersions';

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('2.1.170', '2.1.170')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('returns a negative number when a is older', () => {
    expect(compareVersions('2.1.169', '2.1.170')).toBeLessThan(0);
    expect(compareVersions('1.9.9', '2.0.0')).toBeLessThan(0);
  });

  it('returns a positive number when a is newer', () => {
    expect(compareVersions('2.1.171', '2.1.170')).toBeGreaterThan(0);
    expect(compareVersions('2.2.0', '2.1.170')).toBeGreaterThan(0);
  });

  it('handles differing component counts (missing treated as 0)', () => {
    // '2.1' === '2.1.0' which is older than '2.1.170'
    expect(compareVersions('2.1', '2.1.170')).toBeLessThan(0);
    expect(compareVersions('2.1.170', '2.1')).toBeGreaterThan(0);
    expect(compareVersions('2.1', '2.1.0')).toBe(0);
  });

  it('treats NaN / empty components as 0', () => {
    // '' → NaN → 0, so equal to '0.0.0'
    expect(compareVersions('', '0.0.0')).toBe(0);
    expect(compareVersions('2.x.1', '2.0.1')).toBe(0);
    expect(compareVersions('', '1.0.0')).toBeLessThan(0);
  });
});

describe('isAtLeastVersion', () => {
  it('returns false for a null / undefined version (undetected CLI)', () => {
    expect(isAtLeastVersion(null, '2.1.170')).toBe(false);
    expect(isAtLeastVersion(undefined, '2.1.170')).toBe(false);
  });

  it('returns true when the version exactly meets the minimum', () => {
    expect(isAtLeastVersion('2.1.170', '2.1.170')).toBe(true);
  });

  it('returns true when the version exceeds the minimum', () => {
    expect(isAtLeastVersion('2.1.198', '2.1.170')).toBe(true);
    expect(isAtLeastVersion('2.2.0', '2.1.170')).toBe(true);
  });

  it('returns false when the version is below the minimum', () => {
    expect(isAtLeastVersion('2.1.169', '2.1.170')).toBe(false);
  });
});
