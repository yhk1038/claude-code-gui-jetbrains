import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockNavigateToLogin, mockRefetch, authState } = vi.hoisted(() => ({
  mockNavigateToLogin: vi.fn(),
  mockRefetch: vi.fn(),
  authState: { loggedIn: null as boolean | null },
}));

vi.mock('@/hooks', () => ({
  useNavigateToLogin: () => mockNavigateToLogin,
}));

vi.mock('@/contexts', () => ({
  useAuthContext: () => ({ loggedIn: authState.loggedIn, refetch: mockRefetch }),
}));

import { LoginCta } from '../index';

describe('LoginCta', () => {
  beforeEach(() => {
    mockNavigateToLogin.mockReset();
    mockRefetch.mockReset();
    mockRefetch.mockResolvedValue(undefined);
    authState.loggedIn = null;
  });

  describe('when logged out', () => {
    beforeEach(() => { authState.loggedIn = false; });

    it('shows "Re-Sign" at full opacity', () => {
      const { container } = render(<LoginCta />);
      expect(screen.getByRole('button', { name: /re-sign/i })).toBeInTheDocument();
      expect(container.querySelector('.opacity-50')).toBeNull();
    });

    it('navigates to the login page when clicked', () => {
      render(<LoginCta />);
      fireEvent.click(screen.getByRole('button', { name: /re-sign/i }));
      expect(mockNavigateToLogin).toHaveBeenCalled();
      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });

  describe('when login state is undetermined (null)', () => {
    it('shows "Re-Sign" (active) and navigates on click', () => {
      authState.loggedIn = null;
      render(<LoginCta />);
      fireEvent.click(screen.getByRole('button', { name: /re-sign/i }));
      expect(mockNavigateToLogin).toHaveBeenCalled();
    });
  });

  describe('when logged in', () => {
    beforeEach(() => { authState.loggedIn = true; });

    it('shows "Signed" dimmed at 50% opacity (does not hide)', () => {
      const { container } = render(<LoginCta />);
      expect(screen.getByRole('button', { name: /signed/i })).toBeInTheDocument();
      expect(container.querySelector('.opacity-50')).not.toBeNull();
    });

    it('re-checks auth status on click instead of navigating', () => {
      render(<LoginCta />);
      fireEvent.click(screen.getByRole('button', { name: /signed/i }));
      expect(mockRefetch).toHaveBeenCalled();
      expect(mockNavigateToLogin).not.toHaveBeenCalled();
    });

    it('shows a spinner while the silent re-check is in flight', async () => {
      let resolveRefetch: () => void = () => {};
      mockRefetch.mockReturnValue(new Promise<void>((r) => { resolveRefetch = r; }));
      const { container } = render(<LoginCta />);
      fireEvent.click(screen.getByRole('button', { name: /signed/i }));
      expect(container.querySelector('.animate-spin')).not.toBeNull();
      resolveRefetch();
      await waitFor(() => expect(container.querySelector('.animate-spin')).toBeNull());
    });
  });
});
