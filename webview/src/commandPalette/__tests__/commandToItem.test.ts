import { describe, it, expect } from 'vitest';
import { commandToItem } from '../commandToItem';
import { StaticItem } from '../types';

describe('commandToItem', () => {
  // Regression: the searchOnly flag must survive the StaticItem -> PanelItem
  // conversion. It was dropped from the `base` object, so searchOnly items
  // (e.g. "Resume conversation") leaked into the panel without a search query.
  it('carries searchOnly through to the PanelItem', () => {
    const cmd = new StaticItem('resume', 'Resume conversation', {
      disabled: false,
      searchOnly: true,
      action: async () => {},
    });

    expect(commandToItem(cmd).searchOnly).toBe(true);
  });

  it('leaves searchOnly undefined for ordinary items', () => {
    const cmd = new StaticItem('attach', 'Attach file...', {
      disabled: false,
      action: async () => {},
    });

    expect(commandToItem(cmd).searchOnly).toBeUndefined();
  });
});
