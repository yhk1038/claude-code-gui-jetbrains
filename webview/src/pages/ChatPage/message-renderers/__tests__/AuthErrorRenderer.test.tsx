import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadedMessageDto } from '../../../../types';
import { LoadedMessageType, toInstance } from '../../../../dto/common';

vi.mock('../../LoginCta', () => ({
  LoginCta: () => <button data-testid="login-cta">Re-Sign</button>,
}));

import { AuthErrorRenderer } from '../AuthErrorRenderer';

function authErrorMessage(): LoadedMessageDto {
  return toInstance(LoadedMessageDto, {
    type: LoadedMessageType.Assistant,
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: 'Failed to authenticate. API Error: 401 Invalid authentication credentials' }],
    },
    isApiErrorMessage: true,
    apiErrorStatus: 401,
    error: 'authentication_failed',
  });
}

describe('AuthErrorRenderer', () => {
  it('renders the error text', () => {
    render(<AuthErrorRenderer message={authErrorMessage()} />);
    expect(screen.getByText(/failed to authenticate/i)).toBeInTheDocument();
  });

  it('renders the inline login CTA', () => {
    render(<AuthErrorRenderer message={authErrorMessage()} />);
    expect(screen.getByTestId('login-cta')).toBeInTheDocument();
  });

  it('shows the red status dot', () => {
    const { container } = render(<AuthErrorRenderer message={authErrorMessage()} />);
    expect(container.querySelector('.text-red-500')).not.toBeNull();
  });
});
