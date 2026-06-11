import { describe, it, expect } from 'vitest';
import { tunnelErrorGuidance } from '../tunnelError';

describe('tunnelErrorGuidance', () => {
  it('cloudflared-missing → offers a manual install command and help link', () => {
    const g = tunnelErrorGuidance('cloudflared-missing');
    expect(g.manualInstallCommand).toBeTruthy();
    expect(g.helpUrl).toBeTruthy();
    expect(g.title).toMatch(/cloudflared/i);
  });

  it('tunnel-timeout → network-oriented guidance, no install command', () => {
    const g = tunnelErrorGuidance('tunnel-timeout');
    expect(g.manualInstallCommand).toBeUndefined();
    expect(g.detail).toMatch(/network|firewall|region/i);
  });

  it('tunnel-exited → suggests retrying, no install command', () => {
    const g = tunnelErrorGuidance('tunnel-exited');
    expect(g.manualInstallCommand).toBeUndefined();
    expect(g.detail).toMatch(/again/i);
  });

  it('unknown code → falls back to the raw backend message', () => {
    const g = tunnelErrorGuidance('unknown', 'raw backend message');
    expect(g.detail).toBe('raw backend message');
  });

  it('null code with no fallback → still returns a generic title and detail', () => {
    const g = tunnelErrorGuidance(null);
    expect(g.title).toBeTruthy();
    expect(g.detail).toBeTruthy();
  });
});
