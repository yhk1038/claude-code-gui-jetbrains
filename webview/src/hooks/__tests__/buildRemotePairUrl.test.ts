import { describe, it, expect } from 'vitest';
import { buildRemotePairUrl } from '../buildRemotePairUrl';

const BACKEND = 'https://dial-ace-ctrl.trycloudflare.com/?pair=CODE123';

describe('buildRemotePairUrl', () => {
  it('carries the desktop session path + query onto the tunnel origin', () => {
    const href = 'http://localhost:5175/sessions/abc?workingDir=%2Fprivate%2Ftmp';
    expect(buildRemotePairUrl(BACKEND, href)).toBe(
      'https://dial-ace-ctrl.trycloudflare.com/sessions/abc?workingDir=%2Fprivate%2Ftmp&pair=CODE123',
    );
  });

  it('preserves the pairing code and drops any local auth token', () => {
    const href = 'http://localhost:5175/sessions/x?token=SECRET&workingDir=%2Ftmp';
    const out = buildRemotePairUrl(BACKEND, href);
    expect(out).toContain('pair=CODE123');
    expect(out).not.toContain('token');
    expect(out).not.toContain('SECRET');
    expect(out).toContain('/sessions/x');
  });

  it('does not duplicate pair when the local URL already had one', () => {
    const href = 'http://localhost:5175/sessions/y?pair=OLD&foo=1';
    const out = buildRemotePairUrl(BACKEND, href);
    expect(out.match(/pair=/g)).toHaveLength(1);
    expect(out).toContain('pair=CODE123');
    expect(out).not.toContain('OLD');
  });

  it('works at the project-list root', () => {
    expect(buildRemotePairUrl(BACKEND, 'http://localhost:5175/')).toBe(
      'https://dial-ace-ctrl.trycloudflare.com/?pair=CODE123',
    );
  });

  it('preserves the hash fragment', () => {
    const href = 'http://localhost:5175/sessions/z#frag';
    expect(buildRemotePairUrl(BACKEND, href)).toBe(
      'https://dial-ace-ctrl.trycloudflare.com/sessions/z?pair=CODE123#frag',
    );
  });

  it('falls back to the backend URL on malformed input', () => {
    expect(buildRemotePairUrl('not a url', 'http://x/')).toBe('not a url');
  });
});
