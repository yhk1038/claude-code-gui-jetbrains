import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DiffCard } from '../DiffCard';
import { DiffStatus, FileOperation } from '../../../types';
import type { PendingDiff } from '../../../types';

// Mock DiffViewer to avoid react-diff-view dependency
vi.mock('../DiffViewer', () => ({
  DiffViewer: ({ filePath, diffText }: { filePath: string; diffText: string }) => (
    <div data-testid="diff-viewer">Diff for {filePath}</div>
  ),
}));

function createDiff(overrides: Partial<PendingDiff> = {}): PendingDiff {
  return {
    id: 'diff-1',
    filePath: 'src/main.ts',
    diff: '--- a/src/main.ts\n+++ b/src/main.ts\n@@ -1,3 +1,4 @@\n import a;\n+import b;\n const x = 1;',
    summary: {
      additions: 1,
      deletions: 0,
      operation: FileOperation.Modify,
    },
    status: DiffStatus.Pending,
    toolUseId: 'tool-1',
    ...overrides,
  };
}

describe('DiffCard', () => {
  const defaultProps = {
    onApply: vi.fn().mockResolvedValue(undefined),
    onReject: vi.fn(),
  };

  it('renders file path', () => {
    render(<DiffCard diff={createDiff()} {...defaultProps} />);
    expect(screen.getByText('src/main.ts')).toBeInTheDocument();
  });

  it('renders operation label for Modify', () => {
    render(<DiffCard diff={createDiff()} {...defaultProps} />);
    expect(screen.getByText('Modify')).toBeInTheDocument();
  });

  it('renders operation label for Create', () => {
    render(
      <DiffCard
        diff={createDiff({ summary: { additions: 10, deletions: 0, operation: FileOperation.Create } })}
        {...defaultProps}
      />,
    );
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('renders operation label for Delete', () => {
    render(
      <DiffCard
        diff={createDiff({ summary: { additions: 0, deletions: 5, operation: FileOperation.Delete } })}
        {...defaultProps}
      />,
    );
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('shows additions and deletions count', () => {
    render(
      <DiffCard
        diff={createDiff({ summary: { additions: 3, deletions: 2, operation: FileOperation.Modify } })}
        {...defaultProps}
      />,
    );
    expect(screen.getByText('+3 -2')).toBeInTheDocument();
  });

  it('shows Pending badge for pending diff', () => {
    render(<DiffCard diff={createDiff()} {...defaultProps} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows Applied badge for applied diff', () => {
    render(<DiffCard diff={createDiff({ status: DiffStatus.Applied })} {...defaultProps} />);
    expect(screen.getByText('Applied')).toBeInTheDocument();
  });

  it('shows Rejected badge for rejected diff', () => {
    render(<DiffCard diff={createDiff({ status: DiffStatus.Rejected })} {...defaultProps} />);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('shows Apply/Reject buttons only for pending diff', () => {
    const { rerender } = render(<DiffCard diff={createDiff()} {...defaultProps} />);
    expect(screen.getByText('Apply')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();

    rerender(<DiffCard diff={createDiff({ status: DiffStatus.Applied })} {...defaultProps} />);
    expect(screen.queryByText('Apply')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('calls onApply when Apply button is clicked', async () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    render(<DiffCard diff={createDiff()} onApply={onApply} onReject={vi.fn()} />);
    fireEvent.click(screen.getByText('Apply'));
    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith('diff-1');
    });
  });

  it('calls onReject when Reject button is clicked', () => {
    const onReject = vi.fn();
    render(<DiffCard diff={createDiff()} onApply={vi.fn().mockResolvedValue(undefined)} onReject={onReject} />);
    fireEvent.click(screen.getByText('Reject'));
    expect(onReject).toHaveBeenCalledWith('diff-1');
  });

  it('renders DiffViewer when expanded (default)', () => {
    render(<DiffCard diff={createDiff()} {...defaultProps} />);
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('shows Open in IDE button when onOpenInIDE is provided', () => {
    render(
      <DiffCard
        diff={createDiff()}
        {...defaultProps}
        onOpenInIDE={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByText('Open in IDE')).toBeInTheDocument();
  });
});
