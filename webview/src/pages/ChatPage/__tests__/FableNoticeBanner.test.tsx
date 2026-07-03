import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FableNoticeBanner } from '../FableNoticeBanner';

describe('FableNoticeBanner', () => {
  it('renders the available title, usage copy, and a Learn more link', () => {
    render(<FableNoticeBanner variant="available" onClose={() => {}} />);
    expect(screen.getByText('Fable is now available')).toBeInTheDocument();
    expect(screen.getByText(/50% of your plan limits on Fable 5 through July 7/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /learn more/i });
    expect(link).toHaveAttribute('href', 'https://www.anthropic.com/news/fable-mythos-access');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders the update-required title and CLI version copy', () => {
    render(<FableNoticeBanner variant="update-required" onClose={() => {}} />);
    expect(screen.getByText('Update to use Fable 5')).toBeInTheDocument();
    expect(screen.getByText(/requires Claude Code CLI v2\.1\.170 or newer/)).toBeInTheDocument();
    // The promo usage copy must NOT appear in the update-required variant.
    expect(screen.queryByText(/50% of your plan limits/)).not.toBeInTheDocument();
    // Learn more link is reused across variants.
    expect(screen.getByRole('link', { name: /learn more/i })).toHaveAttribute(
      'href',
      'https://www.anthropic.com/news/fable-mythos-access',
    );
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<FableNoticeBanner variant="available" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
