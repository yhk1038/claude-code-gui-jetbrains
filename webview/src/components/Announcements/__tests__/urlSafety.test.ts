import { describe, it, expect } from 'vitest';
import { isSafeLinkUrl, isSafeImageUrl } from '../urlSafety';

describe('isSafeLinkUrl', () => {
  it('allows http, https, and mailto', () => {
    expect(isSafeLinkUrl('http://example.com')).toBe(true);
    expect(isSafeLinkUrl('https://example.com/path?q=1')).toBe(true);
    expect(isSafeLinkUrl('mailto:hi@example.com')).toBe(true);
    expect(isSafeLinkUrl('  HTTPS://Example.com  ')).toBe(true); // trims + case-insensitive
  });

  it('rejects scripting / local / data schemes', () => {
    expect(isSafeLinkUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeLinkUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeLinkUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeLinkUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeLinkUrl('')).toBe(false);
    expect(isSafeLinkUrl('  javascript:alert(1)')).toBe(false); // leading space doesn't smuggle
  });
});

describe('isSafeImageUrl', () => {
  it('allows only https and inline data:image', () => {
    expect(isSafeImageUrl('https://cdn.example.com/hero.png')).toBe(true);
    expect(isSafeImageUrl('data:image/png;base64,iVBOR...')).toBe(true);
  });

  it('rejects http (mixed content), data:text/html, and scripting schemes', () => {
    expect(isSafeImageUrl('http://example.com/hero.png')).toBe(false);
    expect(isSafeImageUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeImageUrl('')).toBe(false);
  });
});
