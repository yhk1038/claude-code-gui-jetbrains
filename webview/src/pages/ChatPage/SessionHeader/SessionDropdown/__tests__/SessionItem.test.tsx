import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionItem } from '../SessionItem';
import { SessionMetaDto } from '@/dto';

const createMockSession = (overrides: Partial<SessionMetaDto> = {}): SessionMetaDto => {
  return Object.assign(new SessionMetaDto(), {
    id: 'test-session-1',
    title: 'Test Session',
    createdAt: new Date('2026-03-20T10:00:00Z'),
    updatedAt: new Date('2026-03-20T11:00:00Z'),
    messageCount: 5,
    isSidechain: false,
    ...overrides,
  });
};

describe('SessionItem', () => {
  let onSelect: ReturnType<typeof vi.fn>;
  let onDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSelect = vi.fn();
    onDelete = vi.fn();
  });

  it('renders the session title', () => {
    const session = createMockSession({ title: 'My Session' });

    render(
      <SessionItem
        session={session}
        isSelected={false}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('My Session')).toBeDefined();
  });

  it('calls onSelect when the button is clicked', () => {
    const session = createMockSession();

    render(
      <SessionItem
        session={session}
        isSelected={false}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Test Session/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows delete button on hover', () => {
    const session = createMockSession();

    render(
      <SessionItem
        session={session}
        isSelected={false}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    );

    expect(screen.queryByTitle('Delete session')).toBeNull();

    fireEvent.mouseEnter(screen.getByRole('button', { name: /Test Session/i }));

    expect(screen.getByTitle('Delete session')).toBeDefined();
  });

  it('calls onDelete when delete button is clicked', () => {
    const session = createMockSession();

    render(
      <SessionItem
        session={session}
        isSelected={false}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /Test Session/i }));
    fireEvent.click(screen.getByTitle('Delete session'));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not call onSelect when delete button is clicked', () => {
    const session = createMockSession();

    render(
      <SessionItem
        session={session}
        isSelected={false}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /Test Session/i }));
    fireEvent.click(screen.getByTitle('Delete session'));

    expect(onSelect).not.toHaveBeenCalled();
  });
});
