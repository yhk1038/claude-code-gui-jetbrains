import { describe, it, expect } from 'vitest';
import { validateOrigin, isNonLoopbackBind } from '../ws-server';

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
