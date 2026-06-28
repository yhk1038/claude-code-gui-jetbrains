/**
 * Claude Code CLI effort level configuration.
 *
 * The CLI reports per-model effort support via the `control_response`
 * returned from `initialize` (see `ModelInfo.supportsEffort` and
 * `ModelInfo.supportedEffortLevels`). The plugin derives the available
 * levels from that response rather than hardcoding them, so newly added
 * values (e.g. `xhigh`, `max`) and per-model differences are respected.
 *
 * `auto` is a plugin-side sentinel meaning "use the CLI default" — it is
 * persisted to `~/.claude/settings.json` as `effortLevel: null`. It is NOT a
 * slider step: matching the Cursor extension, the levels are exactly the
 * model's `supportedEffortLevels` (low/medium/high/xhigh/max), and `auto` is
 * only the label shown while the level is unset.
 */
import { toModelAlias, DEFAULT_MODEL_ALIAS } from './models';
import type { CliConfigControlResponse, ModelInfo } from './slashCommand';

export const EFFORT_AUTO = 'auto';

export interface EffortLevelDef {
  key: string;
  label: string;
  filledDots: number;
  totalDots: number;
}

// Display labels, matching the Cursor extension's map exactly
// ({low:"Low",medium:"Medium",high:"High",xhigh:"Extra high",max:"Max"}).
function labelFor(key: string): string {
  if (key === EFFORT_AUTO) return 'Auto';
  if (key === 'xhigh') return 'Extra high';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * The slider steps: exactly the model's supported levels, no `auto` step.
 */
export function buildEffortLevels(supported: string[]): EffortLevelDef[] {
  const totalDots = supported.length;
  return supported.map((key, i) => ({
    key,
    label: labelFor(key),
    filledDots: i + 1,
    totalDots,
  }));
}

/**
 * Resolve the def for the current value. Unset (null/undefined/`auto`) yields
 * the "Auto" label with no filled dots — the slider then sits at the first
 * stop, exactly as the Cursor extension renders an unset level.
 */
export function getEffortDef(
  key: string | null | undefined,
  supported: string[],
): EffortLevelDef {
  if (!key || key === EFFORT_AUTO) {
    return { key: EFFORT_AUTO, label: 'Auto', filledDots: 0, totalDots: supported.length };
  }
  const levels = buildEffortLevels(supported);
  return (
    levels.find((l) => l.key === key) ??
    { key: EFFORT_AUTO, label: 'Auto', filledDots: 0, totalDots: supported.length }
  );
}

/**
 * Advance to the next effort level, wrapping max → first. The unset state
 * (`auto`/null) advances to the first level. Never returns `auto`: once a
 * level is chosen the cycle stays within low…max, matching Cursor.
 */
export function nextEffortLevel(
  current: string | null | undefined,
  supported: string[],
): string | null {
  if (supported.length === 0) return null;
  // Unset/auto → indexOf is -1 → next is supported[0].
  const idx = current ? supported.indexOf(current) : -1;
  return supported[(idx + 1) % supported.length];
}

export function parseEffortLevel(
  value: string | null | undefined,
  supported: string[],
): string {
  if (!value) return EFFORT_AUTO;
  return supported.includes(value) ? value : EFFORT_AUTO;
}

export interface ModelEffortConfig {
  supportsEffort: boolean;
  levels: string[];
}

/**
 * Resolve the current model's effort configuration from the CLI control
 * response. The CLI keys models by short `value` (`default`, `sonnet`,
 * `haiku`); `settings.model` is either a full CLI model ID or `null`.
 */
export function getModelEffortConfig(
  controlResponse: CliConfigControlResponse | null,
  settingsModel: string | null | undefined,
): ModelEffortConfig {
  const models: ModelInfo[] = controlResponse?.response?.response?.models ?? [];
  const alias = settingsModel ? toModelAlias(settingsModel) : DEFAULT_MODEL_ALIAS;
  const info = models.find((m) => m.value === alias);
  if (!info?.supportsEffort) return { supportsEffort: false, levels: [] };
  return { supportsEffort: true, levels: info.supportedEffortLevels ?? [] };
}
