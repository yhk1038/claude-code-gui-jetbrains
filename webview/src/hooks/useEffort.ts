import { useCallback } from 'react';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';
import { useCliConfig } from '@/contexts/CliConfigContext';
import {
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
}

/**
 * Resolves the current model's effort configuration from the CLI's
 * `control_response` and the user's settings, and exposes a `cycle`
 * helper that advances to the next supported level (wrapping to auto).
 *
 * Keeps the model → levels inference in one place so UI consumers
 * (command palette row, keyboard handler, future surfaces) don't
 * reimplement it.
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

  return { supportsEffort, levels, current, def, cycle };
}
