import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockNavigateToLogin, authState } = vi.hoisted(() => ({
  mockNavigateToLogin: vi.fn(),
  authState: { loggedIn: null as boolean | null },
}));

vi.mock('@/contexts', () => ({
  useAuthContext: () => ({ loggedIn: authState.loggedIn, refetch: vi.fn() }),
}));

vi.mock('@/hooks', () => ({
  useNavigateToLogin: () => mockNavigateToLogin,
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { AuthErrorBanner } from '../AuthErrorBanner';

describe('AuthErrorBanner', () => {
  beforeEach(() => {
    mockNavigateToLogin.mockReset();
    authState.loggedIn = null;
  });

  it('renders nothing while the login state is undetermined (null)', () => {
    authState.loggedIn = null;
    const { container } = render(<AuthErrorBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when logged in', () => {
    authState.loggedIn = true;
    const { container } = render(<AuthErrorBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the banner with a login button ONLY on a definitive logout (loggedIn === false)', () => {
    authState.loggedIn = false;
    render(<AuthErrorBanner />);
    expect(screen.getByText('authError.banner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /authError\.login/ })).toBeInTheDocument();
  });

  it('navigates to login (remembering fallback) when the button is clicked', () => {
    authState.loggedIn = false;
    render(<AuthErrorBanner />);
    fireEvent.click(screen.getByRole('button', { name: /authError\.login/ }));
    expect(mockNavigateToLogin).toHaveBeenCalledTimes(1);
  });
});
