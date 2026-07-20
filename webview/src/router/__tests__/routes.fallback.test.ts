import { describe, it, expect } from 'vitest';
import { loginPathWithFallback, fallbackFromSearch, FALLBACK_PARAM } from '../routes';

describe('loginPathWithFallback', () => {
  it('appends the current location as an encoded fallback param', () => {
    const current = '/sessions/abc?workingDir=%2Ftmp';
    const result = loginPathWithFallback(current);
    expect(result).toContain('/switch-account');
    expect(result).toContain(`${FALLBACK_PARAM}=${encodeURIComponent(current)}`);
  });

  it('does not stack login-on-login (already on switch-account → no fallback)', () => {
    const result = loginPathWithFallback('/switch-account?fallback=%2Fsessions%2Fabc');
    expect(result).toBe('/switch-account');
    expect(result).not.toContain('fallback=');
  });
});

describe('fallbackFromSearch', () => {
  it('returns the decoded fallback destination', () => {
    const search = `?${FALLBACK_PARAM}=${encodeURIComponent('/sessions/abc')}`;
    expect(fallbackFromSearch(search)).toBe('/sessions/abc');
  });

  it('returns null when no fallback param is present', () => {
    expect(fallbackFromSearch('')).toBeNull();
    expect(fallbackFromSearch('?workingDir=%2Ftmp')).toBeNull();
  });

  it('returns null when the fallback would loop back to the login page', () => {
    const search = `?${FALLBACK_PARAM}=${encodeURIComponent('/switch-account')}`;
    expect(fallbackFromSearch(search)).toBeNull();
  });
});
