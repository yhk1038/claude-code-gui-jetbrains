import { PanelSection, PanelSectionId } from '@/types/commandPalette';
import { EFFORT_UNSUPPORTED_REASON } from './sections/model/EffortItem';
import { FAST_MODE_UNSUPPORTED_REASON } from './sections/model/ToggleFastModeItem';

export interface ModelCapabilityFlags {
  supportsEffort: boolean;
  supportsFastMode: boolean;
}

/**
 * Inject disabled/disabledReason into the Model section's effort and
 * toggle-fast-mode items based on the current model's capabilities. Rows for
 * unsupported capabilities stay visible but disabled (with a hover tooltip
 * explaining why), instead of being hidden from the panel. Pure function —
 * returns a new section object (and never mutates the input) so it's safe to
 * call from a `useMemo` derivation.
 */
export function applyModelCapabilityFlags(
  section: PanelSection,
  flags: ModelCapabilityFlags,
): PanelSection {
  if (section.id !== PanelSectionId.Model) return section;
  return {
    ...section,
    items: section.items.map((it) => {
      if (it.id === 'effort') {
        return {
          ...it,
          disabled: !flags.supportsEffort,
          disabledReason: flags.supportsEffort ? undefined : EFFORT_UNSUPPORTED_REASON,
        };
      }
      if (it.id === 'toggle-fast-mode') {
        return {
          ...it,
          disabled: !flags.supportsFastMode,
          disabledReason: flags.supportsFastMode ? undefined : FAST_MODE_UNSUPPORTED_REASON,
        };
      }
      return it;
    }),
  };
}
