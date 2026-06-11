import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from '../index';
import type { SelectOption } from '../types';

const OPTIONS: SelectOption[] = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

describe('Select', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  const renderSelect = (override: Partial<Parameters<typeof Select>[0]> = {}) =>
    render(
      <Select
        value="a"
        options={OPTIONS}
        onChange={onChange}
        ariaLabel="Test select"
        {...override}
      />,
    );

  it('renders the selected option label on the trigger', () => {
    renderSelect();
    const trigger = screen.getByRole('button', { name: /Test select/i });
    expect(trigger.textContent).toContain('Option A');
  });

  it('does not show the options list until opened', () => {
    renderSelect();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens the options list when the trigger is clicked', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('button', { name: /Test select/i }));
    expect(screen.getByRole('listbox')).toBeDefined();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('calls onChange with the option value when an option is clicked', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('button', { name: /Test select/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Option B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('closes the list after an option is selected', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('button', { name: /Test select/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Option B' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('marks the currently selected option as aria-selected', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('button', { name: /Test select/i }));
    expect(screen.getByRole('option', { name: 'Option A' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('option', { name: 'Option B' }).getAttribute('aria-selected')).toBe('false');
  });

  it('closes the list when clicking outside', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('button', { name: /Test select/i }));
    expect(screen.getByRole('listbox')).toBeDefined();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes the list when Escape is pressed', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('button', { name: /Test select/i }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('does not open when disabled', () => {
    renderSelect({ disabled: true });
    fireEvent.click(screen.getByRole('button', { name: /Test select/i }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('falls back to an empty trigger label when the value matches no option', () => {
    renderSelect({ value: 'missing' });
    const trigger = screen.getByRole('button', { name: /Test select/i });
    expect(trigger.textContent?.trim()).toBe('');
  });
});
