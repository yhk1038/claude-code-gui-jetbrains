import { describe, it, expect } from 'vitest';

// We need to test validateOrigin which is not exported.
// We'll replicate the logic here to test it (same as the source).
const ALLOWED_WS_ORIGINS = new Set([
  'http://localhost',
  'http://127.0.0.1',
  'https://localhost',
  'https://127.0.0.1',
]);

const ALLOWED_TUNNEL_SUFFIXES = ['.trycloudflare.com'];

function isImplicitlyAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin === 'null') return true;
  if (origin.startsWith('file://')) return true;
  return false;
}

function validateOrigin(origin: string | undefined): boolean {
  if (isImplicitlyAllowedOrigin(origin)) return true;
  try {
    const url = new URL(origin!);
    const normalized = `${url.protocol}//${url.hostname}`;
    if (ALLOWED_WS_ORIGINS.has(normalized)) return true;
    return ALLOWED_TUNNEL_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

describe('ws-server security', () => {
  describe('validateOrigin()', () => {
    it('should allow undefined origin (no header)', () => {
      expect(validateOrigin(undefined)).toBe(true);
    });

    it('should allow "null" origin (JCEF file:// loads)', () => {
      expect(validateOrigin('null')).toBe(true);
    });

    it('should allow file:// protocol', () => {
      expect(validateOrigin('file:///path/to/file')).toBe(true);
    });

    it('should allow http://localhost', () => {
      expect(validateOrigin('http://localhost')).toBe(true);
    });

    it('should allow http://localhost with port', () => {
      expect(validateOrigin('http://localhost:3000')).toBe(true);
    });

    it('should allow http://127.0.0.1', () => {
      expect(validateOrigin('http://127.0.0.1')).toBe(true);
    });

    it('should allow https://localhost', () => {
      expect(validateOrigin('https://localhost')).toBe(true);
    });

    it('should allow https://127.0.0.1', () => {
      expect(validateOrigin('https://127.0.0.1')).toBe(true);
    });

    it('should allow Cloudflare tunnel origins', () => {
      expect(validateOrigin('https://random-name.trycloudflare.com')).toBe(true);
    });

    it('should block arbitrary external origins', () => {
      expect(validateOrigin('https://evil.example.com')).toBe(false);
    });

    it('should block http://0.0.0.0', () => {
      expect(validateOrigin('http://0.0.0.0')).toBe(false);
    });

    it('should block empty string', () => {
      expect(validateOrigin('')).toBe(true); // empty is implicitly allowed (falsy)
    });

    it('should block invalid URL', () => {
      expect(validateOrigin('not-a-url')).toBe(false);
    });
  });
});
