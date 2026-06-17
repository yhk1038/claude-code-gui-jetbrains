import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommandPalette } from '../useCommandPalette';
import { PanelItemType } from '@/types/commandPalette';
import type { ActionItem, PanelSection } from '@/types/commandPalette';
import { PanelSectionId } from '@/types/commandPalette';

// Mock useCommandPaletteRegistry so we don't need Provider context
vi.mock('../../CommandPaletteProvider', () => ({
  useCommandPaletteRegistry: vi.fn(),
}));

import { useCommandPaletteRegistry } from '../../CommandPaletteProvider';

const mockSections: PanelSection[] = [
  {
    id: PanelSectionId.Model,
    title: 'Model',
    showDividerAbove: false,
    items: [
      {
        id: 'model-action',
        label: 'Claude Sonnet',
        type: PanelItemType.Action,
        action: vi.fn(),
      } as ActionItem,
    ],
  },
];

function setupMockRegistry(sections: PanelSection[] = mockSections) {
  vi.mocked(useCommandPaletteRegistry).mockReturnValue({
    sections,
    registry: {} as any,
    keyboardRegistry: {} as any,
  });
}

describe('useCommandPalette', () => {
  let onChange: ReturnType<typeof vi.fn>;
  let textareaRef: { current: HTMLDivElement | null };

  beforeEach(() => {
    vi.clearAllMocks();
    onChange = vi.fn();
    textareaRef = { current: null };
    setupMockRegistry();
  });

  // ──────────────────────────────────────────────────────
  // handleSlashButtonClick
  // ──────────────────────────────────────────────────────

  describe('handleSlashButtonClick', () => {
    it('does not call onChange when input is empty and panel is closed', () => {
      const { result } = renderHook(() =>
        useCommandPalette({ onChange, textareaRef }),
      );

      act(() => {
        result.current.handleSlashButtonClick();
      });

      expect(onChange).not.toHaveBeenCalled();
      expect(result.current.showSlashCommands).toBe(true);
    });

    it('does not call onChange when input has existing text and panel is closed', () => {
      const { result } = renderHook(() =>
        useCommandPalette({ onChange, textareaRef }),
      );

      // Simulate: user already typed something in the textarea
      // The hook itself does not hold the input value — it only exposes onChange.
      // So we verify onChange is NOT called regardless of external textarea state.
      act(() => {
        result.current.handleSlashButtonClick();
      });

      // onChange must never be called from handleSlashButtonClick
      expect(onChange).not.toHaveBeenCalled();
      expect(result.current.showSlashCommands).toBe(true);
    });

    it('opens the panel when closed', () => {
      const { result } = renderHook(() =>
        useCommandPalette({ onChange, textareaRef }),
      );

      expect(result.current.showSlashCommands).toBe(false);

      act(() => {
        result.current.handleSlashButtonClick();
      });

      expect(result.current.showSlashCommands).toBe(true);
    });

    it('does nothing when panel is already open', () => {
      const { result } = renderHook(() =>
        useCommandPalette({ onChange, textareaRef }),
      );

      act(() => {
        result.current.handleSlashButtonClick();
      });

      const onChangeCalls = onChange.mock.calls.length;

      act(() => {
        result.current.handleSlashButtonClick();
      });

      // Second click must not call onChange either
      expect(onChange.mock.calls.length).toBe(onChangeCalls);
    });
  });

  // ──────────────────────────────────────────────────────
  // handlePanelItemExecute
  // ──────────────────────────────────────────────────────

  describe('handlePanelItemExecute', () => {
    it('does not call onChange when keepOpen=false item is executed', () => {
      const { result } = renderHook(() =>
        useCommandPalette({ onChange, textareaRef }),
      );

      const actionFn = vi.fn();
      const item: ActionItem = {
        id: 'test-action',
        label: 'Test Action',
        type: PanelItemType.Action,
        keepOpen: false,
        action: actionFn,
      };

      act(() => {
        result.current.handlePanelItemExecute(item);
      });

      expect(actionFn).toHaveBeenCalledTimes(1);
      expect(onChange).not.toHaveBeenCalled();
      expect(result.current.showSlashCommands).toBe(false);
    });

    it('does not call onChange when keepOpen=true item is executed', () => {
      const { result } = renderHook(() =>
        useCommandPalette({ onChange, textareaRef }),
      );

      // Open panel first
      act(() => {
        result.current.handleSlashButtonClick();
      });

      vi.clearAllMocks(); // reset onChange call count after handleSlashButtonClick

      const actionFn = vi.fn();
      const item: ActionItem = {
        id: 'test-action-keep-open',
        label: 'Test Action Keep Open',
        type: PanelItemType.Action,
        keepOpen: true,
        action: actionFn,
      };

      act(() => {
        result.current.handlePanelItemExecute(item);
      });

      expect(actionFn).toHaveBeenCalledTimes(1);
      expect(onChange).not.toHaveBeenCalled();
      // Panel stays open because keepOpen=true
      expect(result.current.showSlashCommands).toBe(true);
    });

    it('closes the panel when keepOpen=false', () => {
      const { result } = renderHook(() =>
        useCommandPalette({ onChange, textareaRef }),
      );

      // Open panel
      act(() => {
        result.current.handleSlashButtonClick();
      });

      expect(result.current.showSlashCommands).toBe(true);

      const item: ActionItem = {
        id: 'close-action',
        label: 'Close Action',
        type: PanelItemType.Action,
        keepOpen: false,
        action: vi.fn(),
      };

      act(() => {
        result.current.handlePanelItemExecute(item);
      });

      expect(result.current.showSlashCommands).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────
  // executeAndClear (called via Enter key path)
  // ──────────────────────────────────────────────────────

  describe('executeAndClear (via handleSlashKeyDown Enter)', () => {
    it('does not call onChange when selected item is executed', () => {
      // Use sections that have a selectable Action item
      const actionFn = vi.fn();
      const sectionsWithItem: PanelSection[] = [
        {
          id: PanelSectionId.Model,
          title: 'Model',
          showDividerAbove: false,
          items: [
            {
              id: 'model-action',
              label: 'Select Model',
              type: PanelItemType.Action,
              action: actionFn,
            } as ActionItem,
          ],
        },
      ];

      setupMockRegistry(sectionsWithItem);

      const { result } = renderHook(() =>
        useCommandPalette({ onChange, textareaRef }),
      );

      // Open panel so there are filtered sections
      act(() => {
        result.current.handleSlashButtonClick();
      });

      vi.clearAllMocks(); // reset onChange count

      // Simulate Enter key press
      const enterEvent = {
        key: 'Enter',
        shiftKey: false,
        nativeEvent: { isComposing: false },
        preventDefault: vi.fn(),
      } as unknown as import('react').KeyboardEvent<HTMLElement>;

      act(() => {
        result.current.handleSlashKeyDown(enterEvent, '/');
      });

      expect(actionFn).toHaveBeenCalledTimes(1);
      expect(onChange).not.toHaveBeenCalled();
      expect(result.current.showSlashCommands).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────
  // searchOnly items — hidden by default, surfaced via search
  // ──────────────────────────────────────────────────────

  describe('searchOnly items', () => {
    const sectionsWithSearchOnly: PanelSection[] = [
      {
        id: PanelSectionId.Context,
        title: 'Context',
        showDividerAbove: false,
        items: [
          {
            id: 'normal',
            label: 'Attach file',
            type: PanelItemType.Action,
            action: vi.fn(),
          } as ActionItem,
          {
            id: 'resume',
            label: 'Resume conversation',
            type: PanelItemType.Action,
            searchOnly: true,
            action: vi.fn(),
          } as ActionItem,
        ],
      },
    ];

    it('hides searchOnly items when filterQuery is empty', () => {
      setupMockRegistry(sectionsWithSearchOnly);
      const { result } = renderHook(() =>
        useCommandPalette({ onChange, textareaRef }),
      );

      const items = result.current.filteredSections.flatMap(s => s.items);
      expect(items.find(i => i.id === 'resume')).toBeUndefined();
      expect(items.find(i => i.id === 'normal')).toBeDefined();
    });

    it('surfaces searchOnly items when filterQuery matches the label', () => {
      setupMockRegistry(sectionsWithSearchOnly);
      const { result } = renderHook(() =>
        useCommandPalette({ onChange, textareaRef }),
      );

      act(() => {
        result.current.setFilterQuery('res');
      });

      const items = result.current.filteredSections.flatMap(s => s.items);
      expect(items.find(i => i.id === 'resume')).toBeDefined();
    });

    it('still hides searchOnly items when filterQuery matches a different item', () => {
      setupMockRegistry(sectionsWithSearchOnly);
      const { result } = renderHook(() =>
        useCommandPalette({ onChange, textareaRef }),
      );

      act(() => {
        result.current.setFilterQuery('attach');
      });

      const items = result.current.filteredSections.flatMap(s => s.items);
      expect(items.find(i => i.id === 'resume')).toBeUndefined();
      expect(items.find(i => i.id === 'normal')).toBeDefined();
    });
  });
});
