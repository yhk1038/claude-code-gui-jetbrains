import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PermissionBanner } from '../PermissionBanner';
import type { PendingPermission } from '../../../hooks/usePendingPermissions';

const mockPermission: PendingPermission = {
  controlRequestId: 'ctrl-1',
  toolName: 'Bash',
  toolUseId: 'tool-1',
  input: { command: 'ls' },
  riskLevel: 'high',
  description: 'Execute: ls',
};

describe('PermissionBanner', () => {
  let onApprove: ReturnType<typeof vi.fn>;
  let onApproveForSession: ReturnType<typeof vi.fn>;
  let onDeny: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onApprove = vi.fn();
    onApproveForSession = vi.fn();
    onDeny = vi.fn();
  });

  it('renders the permission title', () => {
    render(
      <PermissionBanner
        permission={mockPermission}
        onApprove={onApprove}
        onApproveForSession={onApproveForSession}
        onDeny={onDeny}
      />,
    );

    expect(screen.getByText('Run this command?')).toBeInTheDocument();
  });

  it('calls onApprove when option 1 (Yes) is clicked', () => {
    render(
      <PermissionBanner
        permission={mockPermission}
        onApprove={onApprove}
        onApproveForSession={onApproveForSession}
        onDeny={onDeny}
      />,
    );

    fireEvent.click(screen.getByText('Yes'));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onDeny).not.toHaveBeenCalled();
  });

  it('calls onApproveForSession when option 2 (session approve) is clicked', () => {
    render(
      <PermissionBanner
        permission={mockPermission}
        onApprove={onApprove}
        onApproveForSession={onApproveForSession}
        onDeny={onDeny}
      />,
    );

    fireEvent.click(screen.getByText('Yes, allow all commands this session'));
    expect(onApproveForSession).toHaveBeenCalledTimes(1);
    expect(onDeny).not.toHaveBeenCalled();
  });

  it('calls onDeny without reason when option 3 (No) is clicked', () => {
    render(
      <PermissionBanner
        permission={mockPermission}
        onApprove={onApprove}
        onApproveForSession={onApproveForSession}
        onDeny={onDeny}
      />,
    );

    fireEvent.click(screen.getByText('No'));
    expect(onDeny).toHaveBeenCalledTimes(1);
    // Should be called without a reason argument (or with undefined)
    expect(onDeny).toHaveBeenCalledWith();
  });

  it('calls onDeny with reason text when textarea is submitted via Enter', () => {
    render(
      <PermissionBanner
        permission={mockPermission}
        onApprove={onApprove}
        onApproveForSession={onApproveForSession}
        onDeny={onDeny}
      />,
    );

    const textarea = screen.getByPlaceholderText('Tell Claude what to do instead');
    const reason = 'Please use a safer approach';

    fireEvent.change(textarea, { target: { value: reason } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    // onDeny must be called with the reason text
    expect(onDeny).toHaveBeenCalledTimes(1);
    expect(onDeny).toHaveBeenCalledWith(reason);
    expect(onApprove).not.toHaveBeenCalled();
    expect(onApproveForSession).not.toHaveBeenCalled();
  });

  it('does not call onDeny when textarea is empty and Enter is pressed', () => {
    render(
      <PermissionBanner
        permission={mockPermission}
        onApprove={onApprove}
        onApproveForSession={onApproveForSession}
        onDeny={onDeny}
      />,
    );

    const textarea = screen.getByPlaceholderText('Tell Claude what to do instead');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onDeny).not.toHaveBeenCalled();
  });

  it('does not submit on Shift+Enter (allows multiline input)', () => {
    render(
      <PermissionBanner
        permission={mockPermission}
        onApprove={onApprove}
        onApproveForSession={onApproveForSession}
        onDeny={onDeny}
      />,
    );

    const textarea = screen.getByPlaceholderText('Tell Claude what to do instead');
    fireEvent.change(textarea, { target: { value: 'line 1' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(onDeny).not.toHaveBeenCalled();
  });

  it('trims whitespace from reason before passing to onDeny', () => {
    render(
      <PermissionBanner
        permission={mockPermission}
        onApprove={onApprove}
        onApproveForSession={onApproveForSession}
        onDeny={onDeny}
      />,
    );

    const textarea = screen.getByPlaceholderText('Tell Claude what to do instead');
    fireEvent.change(textarea, { target: { value: '  use echo instead  ' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onDeny).toHaveBeenCalledWith('use echo instead');
  });

  it('calls onDeny (cancel) at least once when Escape is pressed', () => {
    render(
      <PermissionBanner
        permission={mockPermission}
        onApprove={onApprove}
        onApproveForSession={onApproveForSession}
        onDeny={onDeny}
      />,
    );

    const textarea = screen.getByPlaceholderText('Tell Claude what to do instead');
    fireEvent.keyDown(textarea, { key: 'Escape' });

    // onDeny used as onCancel — must be called at least once
    expect(onDeny).toHaveBeenCalled();
    // When called as cancel (Escape), it should NOT be called with a reason string
    const calls = onDeny.mock.calls;
    calls.forEach(call => {
      expect(call[0]).toBeUndefined();
    });
  });
});
