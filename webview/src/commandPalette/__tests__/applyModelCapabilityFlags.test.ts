import { describe, it, expect } from 'vitest';
import { applyModelCapabilityFlags } from '../applyModelCapabilityFlags';
import { EFFORT_UNSUPPORTED_REASON } from '../sections/model/EffortItem';
import { FAST_MODE_UNSUPPORTED_REASON } from '../sections/model/ToggleFastModeItem';
import { PanelSection, PanelSectionId, PanelItem, PanelItemType } from '@/types/commandPalette';

function makeItem(id: string, overrides: Partial<PanelItem> = {}): PanelItem {
  return {
    id,
    label: id,
    type: PanelItemType.Action,
    disabled: false,
    valueComponent: () => null,
    action: async () => {},
    ...overrides,
  } as PanelItem;
}

function makeSection(id: PanelSectionId, items: PanelItem[]): PanelSection {
  return {
    id,
    title: id,
    items,
    showDividerAbove: false,
  };
}

describe('applyModelCapabilityFlags', () => {
  it('disables the effort item with EFFORT_UNSUPPORTED_REASON when supportsEffort is false', () => {
    const section = makeSection(PanelSectionId.Model, [makeItem('effort')]);
    const result = applyModelCapabilityFlags(section, { supportsEffort: false, supportsFastMode: true });
    const effort = result.items.find((it) => it.id === 'effort')!;
    expect(effort.disabled).toBe(true);
    expect(effort.disabledReason).toBe(EFFORT_UNSUPPORTED_REASON);
  });

  it('enables the effort item with no disabledReason when supportsEffort is true', () => {
    const section = makeSection(PanelSectionId.Model, [makeItem('effort')]);
    const result = applyModelCapabilityFlags(section, { supportsEffort: true, supportsFastMode: true });
    const effort = result.items.find((it) => it.id === 'effort')!;
    expect(effort.disabled).toBe(false);
    expect(effort.disabledReason).toBeUndefined();
  });

  it('disables the toggle-fast-mode item with FAST_MODE_UNSUPPORTED_REASON when supportsFastMode is false', () => {
    const section = makeSection(PanelSectionId.Model, [makeItem('toggle-fast-mode')]);
    const result = applyModelCapabilityFlags(section, { supportsEffort: true, supportsFastMode: false });
    const fastMode = result.items.find((it) => it.id === 'toggle-fast-mode')!;
    expect(fastMode.disabled).toBe(true);
    expect(fastMode.disabledReason).toBe(FAST_MODE_UNSUPPORTED_REASON);
  });

  it('enables the toggle-fast-mode item with no disabledReason when supportsFastMode is true', () => {
    const section = makeSection(PanelSectionId.Model, [makeItem('toggle-fast-mode')]);
    const result = applyModelCapabilityFlags(section, { supportsEffort: true, supportsFastMode: true });
    const fastMode = result.items.find((it) => it.id === 'toggle-fast-mode')!;
    expect(fastMode.disabled).toBe(false);
    expect(fastMode.disabledReason).toBeUndefined();
  });

  it('returns non-Model sections unchanged', () => {
    const section = makeSection(PanelSectionId.Settings, [makeItem('some-setting')]);
    const result = applyModelCapabilityFlags(section, { supportsEffort: false, supportsFastMode: false });
    expect(result).toBe(section);
  });

  it('leaves other Model items untouched', () => {
    const section = makeSection(PanelSectionId.Model, [makeItem('thinking')]);
    const result = applyModelCapabilityFlags(section, { supportsEffort: false, supportsFastMode: false });
    const thinking = result.items.find((it) => it.id === 'thinking')!;
    expect(thinking.disabled).toBe(false);
    expect(thinking.disabledReason).toBeUndefined();
  });

  it('does not mutate the original section or its items', () => {
    const original = makeSection(PanelSectionId.Model, [makeItem('effort'), makeItem('toggle-fast-mode')]);
    const originalItemsSnapshot = original.items.map((it) => ({ ...it }));

    applyModelCapabilityFlags(original, { supportsEffort: false, supportsFastMode: false });

    expect(original.items.map((it) => ({ ...it }))).toEqual(originalItemsSnapshot);
  });
});
