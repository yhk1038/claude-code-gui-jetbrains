import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolCard } from '../ToolCard';
import { ToolUseStatus } from '../../../dto/common';
import type { ToolUse } from '../../../types';

function createToolUse(overrides: Partial<ToolUse> = {}): ToolUse {
  return {
    id: 'tool_use_12345678',
    name: 'Bash',
    input: { command: 'ls -la' },
    status: ToolUseStatus.Pending,
    ...overrides,
  };
}

describe('ToolCard', () => {
  it('renders tool name and truncated ID', () => {
    render(<ToolCard toolUse={createToolUse()} />);
    expect(screen.getByText('Bash')).toBeInTheDocument();
    expect(screen.getByText(/tool_use/)).toBeInTheDocument();
  });

  it('shows Pending Approval status for pending tool', () => {
    render(<ToolCard toolUse={createToolUse({ status: ToolUseStatus.Pending })} />);
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
  });

  it('shows Completed status for completed tool', () => {
    render(<ToolCard toolUse={createToolUse({ status: ToolUseStatus.Completed })} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows Denied status for denied tool', () => {
    render(<ToolCard toolUse={createToolUse({ status: ToolUseStatus.Denied })} />);
    expect(screen.getByText('Denied')).toBeInTheDocument();
  });

  it('shows approve/deny buttons only for pending status when expanded', () => {
    const { rerender } = render(
      <ToolCard toolUse={createToolUse({ status: ToolUseStatus.Pending })} />,
    );
    // Expand the card
    fireEvent.click(screen.getByText('Bash'));
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Deny')).toBeInTheDocument();

    rerender(
      <ToolCard toolUse={createToolUse({ status: ToolUseStatus.Completed })} />,
    );
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Deny')).not.toBeInTheDocument();
  });

  it('calls onApprove when Approve button is clicked', () => {
    const onApprove = vi.fn();
    render(
      <ToolCard
        toolUse={createToolUse()}
        onApprove={onApprove}
      />,
    );
    // Expand the card first
    fireEvent.click(screen.getByText('Bash'));
    fireEvent.click(screen.getByText('Approve'));
    expect(onApprove).toHaveBeenCalledWith('tool_use_12345678');
  });

  it('calls onDeny when Deny button is clicked', () => {
    const onDeny = vi.fn();
    render(
      <ToolCard
        toolUse={createToolUse()}
        onDeny={onDeny}
      />,
    );
    // Expand the card first
    fireEvent.click(screen.getByText('Bash'));
    fireEvent.click(screen.getByText('Deny'));
    expect(onDeny).toHaveBeenCalledWith('tool_use_12345678');
  });

  it('displays input parameters when expanded', () => {
    render(<ToolCard toolUse={createToolUse({ input: { command: 'echo hello' } })} />);
    // Expand the card
    fireEvent.click(screen.getByText('Bash'));
    expect(screen.getByText(/echo hello/)).toBeInTheDocument();
  });

  it('displays result when expanded and result is present', () => {
    render(
      <ToolCard toolUse={createToolUse({ status: ToolUseStatus.Completed, result: 'command output' })} />,
    );
    // Expand the card first
    fireEvent.click(screen.getByText('Bash'));
    expect(screen.getByText(/command output/)).toBeInTheDocument();
  });

  it('displays error when expanded and error is present', () => {
    render(
      <ToolCard toolUse={createToolUse({ status: ToolUseStatus.Failed, error: 'Permission denied' })} />,
    );
    // Expand the card first
    fireEvent.click(screen.getByText('Bash'));
    expect(screen.getByText(/Permission denied/)).toBeInTheDocument();
  });
});
