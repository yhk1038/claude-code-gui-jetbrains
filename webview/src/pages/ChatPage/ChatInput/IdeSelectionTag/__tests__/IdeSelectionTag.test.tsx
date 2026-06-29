import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { IdeSelectionPayload } from '@/hooks/useIdeSelection';

// ---------------------------------------------------------------------------
// Mock the context hook so the test controls selection + toggle state directly.
// ---------------------------------------------------------------------------

const ctx = {
  currentSelection: null as IdeSelectionPayload | null,
  includeSelection: true,
  toggleIncludeSelection: vi.fn(),
};

vi.mock('@/contexts/IdeSelectionContext', () => ({
  useIdeSelectionContext: () => ctx,
}));

import { IdeSelectionTag } from '../index';

const selection: IdeSelectionPayload = {
  absolutePath: '/work/src/file.ts',
  relativePath: 'src/file.ts',
  startLine: 42,
  endLine: 51,
  selectedText: 'code',
  workingDir: '/work',
  isGitignored: false,
};

beforeEach(() => {
  ctx.currentSelection = null;
  ctx.includeSelection = true;
  ctx.toggleIncludeSelection = vi.fn();
});

describe('IdeSelectionTag', () => {
  it('renders nothing when there is no selection', () => {
    const { container } = render(<IdeSelectionTag />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the line range label for a selection', () => {
    ctx.currentSelection = selection;
    render(<IdeSelectionTag />);
    expect(screen.getByText('file.ts:42-51')).toBeInTheDocument();
  });

  it('shows just the file basename when no line range is present', () => {
    ctx.currentSelection = {
      ...selection,
      startLine: null,
      endLine: null,
      selectedText: null,
    };
    render(<IdeSelectionTag />);
    expect(screen.getByText('file.ts')).toBeInTheDocument();
  });

  it('reflects the included state via aria-pressed', () => {
    ctx.currentSelection = selection;
    ctx.includeSelection = true;
    render(<IdeSelectionTag />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('reflects the excluded state via aria-pressed', () => {
    ctx.currentSelection = selection;
    ctx.includeSelection = false;
    render(<IdeSelectionTag />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles include on click', () => {
    ctx.currentSelection = selection;
    render(<IdeSelectionTag />);
    fireEvent.click(screen.getByRole('button'));
    expect(ctx.toggleIncludeSelection).toHaveBeenCalledTimes(1);
  });
});
