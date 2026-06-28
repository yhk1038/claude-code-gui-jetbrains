import { useCallback } from 'react';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';
import { useCliConfig } from '@/contexts/CliConfigContext';
import {
  EFFORT_AUTO,
  EffortLevelDef,
  getEffortDef,
  getModelEffortConfig,
  nextEffortLevel,
  parseEffortLevel,
} from '@/types/effort';

export interface UseEffortReturn {
  supportsEffort: boolean;
  levels: string[];
  current: string;
  def: EffortLevelDef;
  cycle: () => void;
  setLevel: (key: string) => void;
}

/**
 * Resolves the current model's effort configuration from the CLI's
 * `control_response` and the user's settings, and exposes a `cycle`
 * helper that advances to the next supported level (wrapping to auto).
 *
 * Keeps the model → levels inference in one place so UI consumers
 * (command palette row, keyboard handler, future surfaces) don't
 * reimplement it.
 *
 * `cycle` advances to the next level (wrapping to auto) — used by the
 * keyboard/Enter path. `setLevel` jumps straight to a chosen level —
 * used by the slider's click/drag, where the user picks a position.
 */
export function useEffort(): UseEffortReturn {
  const { settings, updateSetting } = useClaudeSettings();
  const { controlResponse } = useCliConfig();

  const { supportsEffort, levels } = getModelEffortConfig(controlResponse, settings.model);
  const current = parseEffortLevel(settings.effortLevel, levels);
  const def = getEffortDef(current, levels);

  const cycle = useCallback(() => {
    if (!supportsEffort) return;
    const next = nextEffortLevel(settings.effortLevel, levels);
    void updateSetting('effortLevel', next);
  }, [supportsEffort, levels, settings.effortLevel, updateSetting]);

  const setLevel = useCallback((key: string) => {
    if (!supportsEffort) return;
    // `auto` is the plugin-side sentinel — persist it as `null` (CLI default),
    // mirroring nextEffortLevel's contract so settings stay consistent.
    void updateSetting('effortLevel', key === EFFORT_AUTO ? null : key);
  }, [supportsEffort, updateSetting]);

  return { supportsEffort, levels, current, def, cycle, setLevel };
}
