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
 * persisted to `~/.claude/settings.json` as `effortLevel: null`.
 */
import { parseClaudeModel, ClaudeModel } from './models';
import type { CliConfigControlResponse, ModelInfo } from './slashCommand';

export const EFFORT_AUTO = 'auto';

export interface EffortLevelDef {
  key: string;
  label: string;
  filledDots: number;
  totalDots: number;
}

function labelFor(key: string): string {
  if (key === EFFORT_AUTO) return 'Auto';
  if (key === 'xhigh') return 'X-High';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function buildEffortLevels(supported: string[]): EffortLevelDef[] {
  const totalDots = supported.length;
  return [
    { key: EFFORT_AUTO, label: 'Auto', filledDots: totalDots, totalDots },
    ...supported.map((key, i) => ({
      key,
      label: labelFor(key),
      filledDots: i + 1,
      totalDots,
    })),
  ];
}

export function getEffortDef(
  key: string | null | undefined,
  supported: string[],
): EffortLevelDef {
  const levels = buildEffortLevels(supported);
  return levels.find((l) => l.key === (key ?? EFFORT_AUTO)) ?? levels[0];
}

/**
 * Advance to the next effort level. Returns `null` for the `auto`
 * sentinel so the caller can persist it as-is to settings.
 */
export function nextEffortLevel(
  current: string | null | undefined,
  supported: string[],
): string | null {
  const levels = buildEffortLevels(supported);
  const idx = levels.findIndex((l) => l.key === (current ?? EFFORT_AUTO));
  const next = levels[(idx + 1) % levels.length];
  return next.key === EFFORT_AUTO ? null : next.key;
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
  const modelKey = parseClaudeModel(settingsModel) ?? ClaudeModel.DEFAULT;
  const info = models.find((m) => m.value === modelKey);
  if (!info?.supportsEffort) return { supportsEffort: false, levels: [] };
  return { supportsEffort: true, levels: info.supportedEffortLevels ?? [] };
}
