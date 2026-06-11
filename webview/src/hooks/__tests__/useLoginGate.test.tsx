import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Route } from '@/router/routes';

const { mockNavigate, authState } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  authState: { loggedIn: null as boolean | null },
}));

vi.mock('@/router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));
vi.mock('@/contexts', () => ({ useAuthContext: () => ({ loggedIn: authState.loggedIn, refetch: vi.fn() }) }));

import { useLoginGate } from '../useLoginGate';

describe('useLoginGate', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    authState.loggedIn = null;
  });

  it('redirects to the switch-account page when the user is logged out', () => {
    authState.loggedIn = false;
    renderHook(() => useLoginGate());
    expect(mockNavigate).toHaveBeenCalledWith(Route.SWITCH_ACCOUNT);
  });

  it('does NOT redirect while login state is undetermined (null)', () => {
    authState.loggedIn = null;
    renderHook(() => useLoginGate());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does NOT redirect when the user is logged in', () => {
    authState.loggedIn = true;
    renderHook(() => useLoginGate());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
