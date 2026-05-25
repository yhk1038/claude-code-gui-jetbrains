import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../index';

describe('ConfirmDialog', () => {
  const baseProps = {
    title: 'Delete Session',
    message: 'Are you sure you want to delete this session?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders title and message', () => {
    render(<ConfirmDialog {...baseProps} />);

    expect(screen.getByText('Delete Session')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this session?')).toBeInTheDocument();
  });

  it('shows default button labels when confirmLabel and cancelLabel are not provided', () => {
    render(<ConfirmDialog {...baseProps} />);

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows custom button labels when provided', () => {
    render(
      <ConfirmDialog
        {...baseProps}
        confirmLabel="Yes, delete"
        cancelLabel="No, keep it"
      />
    );

    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No, keep it' })).toBeInTheDocument();
  });

  it('calls onConfirm when the Confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the Escape key is pressed', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the backdrop is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);

    // The backdrop is the outermost overlay element (fixed inset-0)
    const backdrop = screen.getByTestId('confirm-dialog-backdrop');
    fireEvent.click(backdrop);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('applies danger style classes to the Confirm button when variant is danger', () => {
    render(<ConfirmDialog {...baseProps} variant="danger" />);

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });

    expect(confirmButton).toHaveClass('bg-state-error-fg');
  });

  it('does not apply danger style classes to the Confirm button when variant is default', () => {
    render(<ConfirmDialog {...baseProps} variant="default" />);

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });

    expect(confirmButton).not.toHaveClass('bg-state-error-fg');
  });

  it('renders into document.body via Portal', () => {
    const { baseElement } = render(<ConfirmDialog {...baseProps} />);

    // When using a Portal, the dialog is appended to document.body,
    // not inside the container div that render() creates.
    // baseElement is document.body, so we verify the dialog is a direct
    // descendant of body rather than nested inside the default container.
    const dialog = screen.getByRole('dialog');
    expect(document.body.contains(dialog)).toBe(true);

    // The default render container should NOT contain the dialog
    // (it should be in a portal sibling, not the wrapper div)
    const wrapper = baseElement.firstElementChild; // the default <div> render target
    expect(wrapper?.contains(dialog)).toBe(false);
  });
});
