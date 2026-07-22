import { describe, it, expect } from 'vitest';
import {
  validateOrigin,
  isNonLoopbackBind,
  extractAuthToken,
  validateAuthToken,
  AUTH_SUBPROTOCOL,
} from '../ws-server';

// These tests exercise the REAL exported validateOrigin (not a replica), so the
// security contract can never silently drift from the source implementation.

describe('ws-server security', () => {
  describe('validateOrigin() — default loopback bind (allowSameOrigin=false)', () => {
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

    it('should allow empty string (implicitly allowed, falsy)', () => {
      expect(validateOrigin('')).toBe(true);
    });

    it('should block invalid URL', () => {
      expect(validateOrigin('not-a-url')).toBe(false);
    });

    it('should NOT allow a LAN origin even when it matches the Host header, when same-origin is off', () => {
      expect(validateOrigin('http://192.168.0.5:19836', '192.168.0.5:19836', false)).toBe(false);
    });
  });

  describe('validateOrigin() — non-loopback bind (allowSameOrigin=true)', () => {
    it('should allow a LAN origin whose host exactly matches the Host header', () => {
      expect(validateOrigin('http://192.168.0.5:19836', '192.168.0.5:19836', true)).toBe(true);
    });

    it('should still block a LAN origin when the Host header differs (cross-origin / rebinding)', () => {
      expect(validateOrigin('http://192.168.0.5:19836', 'evil.example.com', true)).toBe(false);
    });

    it('should block an external origin even with same-origin enabled when hosts differ', () => {
      expect(validateOrigin('https://evil.example.com', '192.168.0.5:19836', true)).toBe(false);
    });

    it('should block when the Host header is missing', () => {
      expect(validateOrigin('http://192.168.0.5:19836', undefined, true)).toBe(false);
    });

    it('should keep allowing loopback origins', () => {
      expect(validateOrigin('http://localhost:19836', '192.168.0.5:19836', true)).toBe(true);
    });
  });

  describe('extractAuthToken() — Sec-WebSocket-Protocol parsing', () => {
    it('returns undefined for a missing header', () => {
      expect(extractAuthToken(undefined)).toBeUndefined();
    });

    it('returns undefined for an empty header', () => {
      expect(extractAuthToken('')).toBeUndefined();
    });

    it('extracts the token paired with the ccg-auth marker (with space)', () => {
      expect(extractAuthToken(`${AUTH_SUBPROTOCOL}, my-secret-token`)).toBe('my-secret-token');
    });

    it('extracts the token paired with the ccg-auth marker (no space)', () => {
      expect(extractAuthToken(`${AUTH_SUBPROTOCOL},my-secret-token`)).toBe('my-secret-token');
    });

    it('returns undefined when only the marker is present (no token)', () => {
      expect(extractAuthToken(AUTH_SUBPROTOCOL)).toBeUndefined();
    });

    it('returns undefined when the marker is absent (bare token, no marker)', () => {
      expect(extractAuthToken('my-secret-token')).toBeUndefined();
    });
  });

  describe('validateAuthToken() — timing-safe comparison', () => {
    const expected = 'a'.repeat(64);

    it('accepts the correct token behind the marker', () => {
      expect(validateAuthToken(`${AUTH_SUBPROTOCOL}, ${expected}`, expected)).toBe(true);
    });

    it('rejects a wrong token of equal length', () => {
      expect(validateAuthToken(`${AUTH_SUBPROTOCOL}, ${'b'.repeat(64)}`, expected)).toBe(false);
    });

    it('rejects a token of different length without throwing', () => {
      expect(validateAuthToken(`${AUTH_SUBPROTOCOL}, short`, expected)).toBe(false);
    });

    it('rejects a missing token (marker only)', () => {
      expect(validateAuthToken(AUTH_SUBPROTOCOL, expected)).toBe(false);
    });

    it('rejects a missing header', () => {
      expect(validateAuthToken(undefined, expected)).toBe(false);
    });

    it('rejects when the marker is absent', () => {
      expect(validateAuthToken(expected, expected)).toBe(false);
    });
  });

  describe('isNonLoopbackBind()', () => {
    it.each(['127.0.0.1', 'localhost', '::1', '', undefined])(
      'treats %s as loopback',
      (host) => {
        expect(isNonLoopbackBind(host)).toBe(false);
      },
    );

    it.each(['0.0.0.0', '192.168.0.5', '10.0.0.2', '::'])(
      'treats %s as non-loopback',
      (host) => {
        expect(isNonLoopbackBind(host)).toBe(true);
      },
    );
  });
});
