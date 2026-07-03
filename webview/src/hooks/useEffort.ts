import { useCallback } from 'react';
import { useClaudeSettings } from '@/contexts/ClaudeSettingsContext';
import { useCliConfig } from '@/contexts/CliConfigContext';
import { useCurrentModel } from '@/hooks/useCurrentModel';
import {
  EFFORT_AUTO,
  EffortLevelDef,
  ULTRACODE_EFFORT,
  ULTRACODE_LABEL,
  getEffortDef,
  getModelEffortConfig,
  isUltracodeAvailable,
  nextEffortStep,
  parseEffortLevel,
} from '@/types/effort';

export interface UseEffortReturn {
  supportsEffort: boolean;
  levels: string[];
  current: string;
  def: EffortLevelDef;
  /** Whether the model+settings allow the ultracode top step. */
  ultracodeAvailable: boolean;
  /** Whether ultracode is currently engaged. */
  ultracodeEnabled: boolean;
  cycle: () => void;
  setLevel: (key: string) => void;
  enableUltracode: () => void;
}

/**
 * Resolves the current model's effort configuration from the CLI's
 * `control_response` and the user's settings, and exposes helpers to change it.
 *
 * Keeps the model → levels inference in one place so UI consumers (command
 * palette row, Modes panel, keyboard handler) don't reimplement it.
 *
 * - `cycle` advances to the next step (Shift+Tab / Enter), including the
 *   ultracode top step when available, wrapping back to the first level.
 * - `setLevel` jumps straight to a chosen level (slider click/drag), clearing
 *   ultracode if it was on.
 * - `enableUltracode` engages ultracode = xhigh effort + the workflows flag.
 *
 * Note on persistence: the Cursor extension applies ultracode as a session-only
 * flag via a runtime control. Our CLI exposes no such control (only
 * set_model/set_permission_mode/set_max_thinking_tokens), so we persist
 * `ultracode` to settings.json — it stays on until toggled off.
 */
export function useEffort(): UseEffortReturn {
  const { settings, updateSetting } = useClaudeSettings();
  const { controlResponse } = useCliConfig();
  const currentModel = useCurrentModel();

  const { supportsEffort, levels } = getModelEffortConfig(controlResponse, currentModel);
  const current = parseEffortLevel(settings.effortLevel, levels);

  const ultracodeAvailable =
    supportsEffort && isUltracodeAvailable(levels, settings.disableWorkflows);
  const ultracodeEnabled = ultracodeAvailable && settings.ultracode === true;

  const def: EffortLevelDef = ultracodeEnabled
    ? { key: 'ultracode', label: ULTRACODE_LABEL, filledDots: levels.length, totalDots: levels.length }
    : getEffortDef(current, levels);

  const enableUltracode = useCallback(() => {
    if (!ultracodeAvailable) return;
    // Order mirrors Cursor: pin xhigh effort first, then raise the flag.
    void (async () => {
      await updateSetting('effortLevel', ULTRACODE_EFFORT);
      await updateSetting('ultracode', true);
    })();
  }, [ultracodeAvailable, updateSetting]);

  const setLevel = useCallback((key: string) => {
    if (!supportsEffort) return;
    void (async () => {
      // Clear the ultracode flag first if it was engaged, mirroring Cursor's
      // setEffortLevel (which writes ultracode:null before the new level).
      if (settings.ultracode === true) await updateSetting('ultracode', null);
      // `auto` is the plugin-side sentinel — persist it as `null` (CLI default).
      await updateSetting('effortLevel', key === EFFORT_AUTO ? null : key);
    })();
  }, [supportsEffort, settings.ultracode, updateSetting]);

  const cycle = useCallback(() => {
    if (!supportsEffort) return;
    const step = nextEffortStep(settings.effortLevel, ultracodeEnabled, levels, ultracodeAvailable);
    if (step.kind === 'ultracode') {
      enableUltracode();
    } else {
      setLevel(step.key);
    }
  }, [supportsEffort, settings.effortLevel, ultracodeEnabled, levels, ultracodeAvailable, enableUltracode, setLevel]);

  return {
    supportsEffort,
    levels,
    current,
    def,
    ultracodeAvailable,
    ultracodeEnabled,
    cycle,
    setLevel,
    enableUltracode,
  };
}
