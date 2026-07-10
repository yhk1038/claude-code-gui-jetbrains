import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PanelItemComponent } from '../PanelItemComponent';
import { PanelItemType } from '@/types/commandPalette';
import type { CommandItem, ActionItem, PanelItem } from '@/types/commandPalette';

const commandItem: CommandItem = {
  id: 'cli-code-review',
  label: '/code-review',
  type: PanelItemType.Command,
  name: '/code-review',
  description: 'Review a GitHub pull request',
  action: vi.fn(),
};

function renderItem(item: PanelItem, query = '') {
  return render(
    <PanelItemComponent
      item={item}
      isSelected={false}
      query={query}
      onClick={vi.fn()}
      onExecute={vi.fn()}
    />,
  );
}

describe('PanelItemComponent', () => {
  it('renders a slash command description alongside its name (issue #167)', () => {
    renderItem(commandItem);
    expect(screen.getByText('/code-review')).toBeInTheDocument();
    expect(screen.getByText('Review a GitHub pull request')).toBeInTheDocument();
  });

  it('does not render a description row for non-command items', () => {
    const action: ActionItem = {
      id: 'attach',
      label: 'Attach file',
      type: PanelItemType.Action,
      action: vi.fn(),
    };
    renderItem(action);
    expect(screen.getByText('Attach file')).toBeInTheDocument();
    expect(
      screen.queryByText('Review a GitHub pull request'),
    ).not.toBeInTheDocument();
  });

  it('bolds the matched portion of both the name and description', () => {
    const { container } = renderItem(commandItem, 'review');
    const strongs = Array.from(container.querySelectorAll('strong')).map(s =>
      s.textContent?.toLowerCase(),
    );
    // "/code-review" -> "review"; "Review a GitHub..." -> "Review"
    expect(strongs).toContain('review');
    expect(strongs.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the name as plain text when the query is empty', () => {
    const { container } = renderItem(commandItem, '');
    expect(container.querySelector('strong')).toBeNull();
  });
});
