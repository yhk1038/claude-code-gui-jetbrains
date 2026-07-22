import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolvePanelId } from '../resolvePanelId';

// ---------------------------------------------------------------------------
// resolvePanelId resolves a stable per-tab panelId with this precedence:
//   1. URL query `panelId` (JCEF embeds it — unchanged behavior)
//   2. a value persisted in sessionStorage (survives reloads, unique per tab)
//   3. a freshly generated crypto.randomUUID(), persisted for reload parity
// sessionStorage here is the deterministic mock installed by src/__tests__/setup.ts.
// ---------------------------------------------------------------------------

// crypto.randomUUID() is typed as a UUID template-literal, so mock values must
// be UUID-shaped (five dash-separated segments) to type-check.
const GEN_UUID_1 = '11111111-1111-1111-1111-111111111111';
const GEN_UUID_2 = '22222222-2222-2222-2222-222222222222';

function setSearch(search: string): void {
  // jsdom updates window.location.search via the history API without a reload.
  window.history.pushState({}, '', search);
}

beforeEach(() => {
  sessionStorage.clear();
  setSearch('/');
});

afterEach(() => {
  vi.restoreAllMocks();
  setSearch('/');
});

describe('resolvePanelId', () => {
  it('returns the URL query panelId when present (JCEF) without persisting it', () => {
    setSearch('/?panelId=jcef-uuid');
    const uuidSpy = vi.spyOn(crypto, 'randomUUID');

    expect(resolvePanelId()).toBe('jcef-uuid');
    // JCEF path must not generate or persist anything.
    expect(uuidSpy).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
  });

  it('generates and persists a uuid in sessionStorage when there is no URL param', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(GEN_UUID_1);

    const id = resolvePanelId();

    expect(id).toBe(GEN_UUID_1);
    // Persisted so a reload reuses it.
    expect(sessionStorage.length).toBe(1);
  });

  it('returns the SAME persisted value on a second call (reload parity), regenerating only once', () => {
    const uuidSpy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce(GEN_UUID_1)
      .mockReturnValueOnce(GEN_UUID_2);

    const first = resolvePanelId();
    const second = resolvePanelId();

    expect(first).toBe(GEN_UUID_1);
    // Second call reads the stored value rather than minting GEN_UUID_2.
    expect(second).toBe(GEN_UUID_1);
    expect(uuidSpy).toHaveBeenCalledTimes(1);
  });

  it('resolves a different value than the URL-param path when no param is present', () => {
    setSearch('/?panelId=jcef-uuid');
    const fromUrl = resolvePanelId();

    setSearch('/');
    sessionStorage.clear();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(GEN_UUID_1);
    const generated = resolvePanelId();

    expect(fromUrl).toBe('jcef-uuid');
    expect(generated).toBe(GEN_UUID_1);
    expect(generated).not.toBe(fromUrl);
  });
});
