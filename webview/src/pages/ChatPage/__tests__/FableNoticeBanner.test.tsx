import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FableNoticeBanner } from '../FableNoticeBanner';

describe('FableNoticeBanner', () => {
  it('renders the title, usage copy, and a Learn more link', () => {
    render(<FableNoticeBanner onClose={() => {}} />);
    expect(screen.getByText('Fable is now available')).toBeInTheDocument();
    expect(screen.getByText(/50% of your plan limits on Fable 5 through July 7/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /learn more/i });
    expect(link).toHaveAttribute('href', 'https://www.anthropic.com/news/fable-mythos-access');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<FableNoticeBanner onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
