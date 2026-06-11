import { describe, it, expect } from 'vitest';
import { augmentedEnv, augmentedPath, buildAugmentedPath } from '../augmented-path';

describe('augmented-path', () => {
  it('buildAugmentedPath returns a PATH string', () => {
    expect(typeof buildAugmentedPath()).toBe('string');
  });

  it('augmentedPath is cached (stable across calls)', () => {
    expect(augmentedPath()).toBe(augmentedPath());
  });

  it('augmentedEnv sets PATH to the augmented path', () => {
    expect(augmentedEnv().PATH).toBe(augmentedPath());
  });

  it('augmentedEnv preserves other process env vars', () => {
    process.env.__AUG_TEST__ = 'xyz';
    try {
      expect(augmentedEnv().__AUG_TEST__).toBe('xyz');
    } finally {
      delete process.env.__AUG_TEST__;
    }
  });

  it('augmentedEnv applies extra vars alongside PATH', () => {
    const env = augmentedEnv({ FOO: 'bar' });
    expect(env.FOO).toBe('bar');
    expect(env.PATH).toBe(augmentedPath());
  });

  it('augmentedEnv lets extra override PATH when explicitly provided', () => {
    expect(augmentedEnv({ PATH: '/custom/bin' }).PATH).toBe('/custom/bin');
  });
});
