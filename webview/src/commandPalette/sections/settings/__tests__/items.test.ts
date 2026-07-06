import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSettingsItems } from '../items';
import { StaticItem } from '../../../types';

const settingsItems = getSettingsItems();

const byId = (id: string): StaticItem =>
  settingsItems.find(item => item.id === id) as StaticItem;

describe('settingsItems', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes a /login command that is search-only', () => {
    const login = byId('login');
    expect(login).toBeDefined();
    expect(login.label).toBe('/login');
    expect(login.searchOnly).toBe(true);
  });

  it('keeps "Switch account" visible by default (not search-only)', () => {
    const switchAccount = byId('switch-account');
    expect(switchAccount).toBeDefined();
    expect(switchAccount.searchOnly).toBeUndefined();
  });

  it('lets "Switch account" surface under the /login search via a keyword', () => {
    const switchAccount = byId('switch-account');
    expect(switchAccount.keywords).toContain('login');
  });

  it('orders /login before "Switch account" so it appears first under /login search', () => {
    const loginIndex = settingsItems.findIndex(item => item.id === 'login');
    const switchIndex = settingsItems.findIndex(item => item.id === 'switch-account');
    expect(loginIndex).toBeGreaterThanOrEqual(0);
    expect(loginIndex).toBeLessThan(switchIndex);
  });

  it('/login navigates to the same route as "Switch account"', async () => {
    const pushState = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    const dispatch = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);

    await byId('switch-account').execute();
    const switchCalls = pushState.mock.calls;
    const switchPath = switchCalls[switchCalls.length - 1]?.[2];
    const switchDispatched = dispatch.mock.calls.length;

    pushState.mockClear();
    dispatch.mockClear();

    await byId('login').execute();
    const loginCalls = pushState.mock.calls;
    const loginPath = loginCalls[loginCalls.length - 1]?.[2];

    expect(loginPath).toBe(switchPath);
    expect(switchDispatched).toBeGreaterThan(0);
    expect(dispatch.mock.calls.length).toBe(switchDispatched);
  });
});
