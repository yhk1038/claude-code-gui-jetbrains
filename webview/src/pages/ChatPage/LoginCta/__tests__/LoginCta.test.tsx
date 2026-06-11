import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Route } from '@/router/routes';

const { mockNavigate, authState } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  authState: { loggedIn: null as boolean | null },
}));

vi.mock('@/router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}));

vi.mock('@/contexts', () => ({
  useAuthContext: () => ({ loggedIn: authState.loggedIn, refetch: vi.fn() }),
}));

import { LoginCta } from '../index';

describe('LoginCta', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    authState.loggedIn = null;
  });

  it('renders a login button when login state is unknown', () => {
    authState.loggedIn = null;
    render(<LoginCta />);
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('renders a login button when the user is logged out', () => {
    authState.loggedIn = false;
    render(<LoginCta />);
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('auto-hides (renders nothing) once the user is logged in', () => {
    authState.loggedIn = true;
    const { container } = render(<LoginCta />);
    expect(container).toBeEmptyDOMElement();
  });

  it('navigates to the switch-account page when clicked', () => {
    authState.loggedIn = false;
    render(<LoginCta />);
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(mockNavigate).toHaveBeenCalledWith(Route.SWITCH_ACCOUNT);
  });
});
