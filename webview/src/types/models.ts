import type { ModelInfo } from './slashCommand';

/**
 * CLI model alias ("default", "opus", "sonnet", "haiku", "fable") used by the
 * Claude Code CLI as the short form of `ModelInfo.value` in the
 * initialize control_response. Full model IDs such as
 * `claude-opus-4-7[1m]` or `claude-fable-5` are mapped to one of these
 * aliases via `toModelAlias`.
 */
export const DEFAULT_MODEL_ALIAS = 'default';

export function toModelAlias(value: string | null | undefined): string {
  if (!value) return DEFAULT_MODEL_ALIAS;
  if (value === DEFAULT_MODEL_ALIAS) return DEFAULT_MODEL_ALIAS;
  if (value === 'opus' || value === 'sonnet' || value === 'haiku' || value === 'fable') return value;
  if (value.includes('opus')) return 'opus';
  if (value.includes('sonnet')) return 'sonnet';
  if (value.includes('haiku')) return 'haiku';
  if (value.includes('fable')) return 'fable';
  return DEFAULT_MODEL_ALIAS;
}

/**
 * Fable 5 support (issue #153).
 *
 * Fable 5 is a limited-window promotional model. Whether the CLI lists it in
 * the `initialize` model catalog is decided per-account by the server
 * (`additionalModelOptionsCache` entitlement), NOT by CLI version — so many
 * accounts never see it in the picker even though `--model fable` activates it
 * fine. To honour CLI equivalence ("what works in the CLI works in the GUI")
 * we surface Fable as a fallback item when the account's catalog omits it.
 *
 * `FABLE_PROMO_END` is the promotion window end used for the "included until"
 * badge and, past that date, to stop offering the fallback.
 * TODO(after 2026-07-07): the promotion window ends; revisit the fallback,
 * badge, and announcement once Fable's post-promo availability is known.
 */
export const FABLE_PROMO_END = '2026-07-07';

/**
 * Badge shown next to the Fable row during the promo window. Kept in the CLI's
 * own wording ("Included until July 7", verbatim from the Fable model row) —
 * see issue #153 appendix. Update alongside `FABLE_PROMO_END` if the window
 * shifts.
 */
export const FABLE_PROMO_BADGE = 'Included until July 7';

/**
 * Whether the Fable promotion window is still open on `now` (inclusive of the
 * end day). ISO date strings compare lexicographically in calendar order, so a
 * simple prefix compare against `FABLE_PROMO_END` suffices.
 */
export function isFablePromoActive(now: Date): boolean {
  return now.toISOString().slice(0, 10) <= FABLE_PROMO_END;
}

/**
 * Hardcoded Fable item appended only when the CLI-provided catalog lacks Fable.
 * `value: 'fable'` matches the verified `--model fable` / `set_model` path.
 * `description` is the CLI's own Fable row text (kept verbatim, not invented).
 */
export const FABLE_FALLBACK_MODEL: ModelInfo = {
  value: 'fable',
  displayName: 'Fable 5',
  description: 'Most capable for your hardest and longest-running tasks',
};

/**
 * Augment the CLI's model list with a Fable fallback when the account's catalog
 * omits it — a merge, not a static override. If the CLI already lists Fable
 * (entitled account), that dynamic entry wins and the hardcoded item is skipped
 * via alias-based dedup, so this quietly no-ops once Fable is served natively.
 * A CLI-served Fable is respected regardless of the promo window — the server,
 * not us, decides post-promo availability; only our hardcoded fallback is
 * gated on the promo still being active (`now`).
 *
 * An empty list is left untouched: length 0 means the CLI config hasn't loaded
 * yet, and consumers treat that as "loading" (hide the tag / show a spinner).
 * Injecting Fable there would defeat that, so only a loaded list is augmented.
 */
export function withFableFallback(models: ModelInfo[], now: Date): ModelInfo[] {
  if (models.length === 0) return models;
  if (models.some((m) => toModelAlias(m.value) === 'fable')) return models;
  if (!isFablePromoActive(now)) return models;
  return [...models, FABLE_FALLBACK_MODEL];
}

/**
 * The model to treat as "current" for display and selection. The running
 * session model (`systemInit` truth) wins once known; before the CLI is
 * spawned (new session, `sessionModel` null) we predict with the user's saved
 * default (`settings.model`); with neither set it's the default alias. This
 * mirrors the auto-mode availability check so the indicator and auto gating
 * never disagree.
 */
export function resolveCurrentModel(
  sessionModel: string | null | undefined,
  settingsModel: string | null | undefined,
): string {
  return sessionModel ?? settingsModel ?? DEFAULT_MODEL_ALIAS;
}

/**
 * Resolve the label to show for a model. The CLI's displayName hides the
 * real model behind generic labels ("Default (recommended)", "Sonnet"),
 * but the description's first "·"-separated segment carries the actual
 * model, e.g. "Opus 4.8 with 1M context · Best for everyday tasks".
 * Keep only the model name + version ("Opus 4.8"), dropping trailing
 * qualifiers; fall back to the full segment, then to displayName.
 */
export function resolveModelLabel(info: ModelInfo): string {
  const firstSegment = info.description?.split('·')[0]?.trim();
  if (!firstSegment) return info.displayName;
  const nameVersion = firstSegment.match(/^.+?\s[\d.]+/);
  return nameVersion ? nameVersion[0].trim() : firstSegment;
}

/**
 * Resolve the `ModelInfo` that best represents `current` within the CLI's
 * model list, with graceful fallbacks so the model indicator never vanishes.
 *
 * `current` may be a precise list value the user picked ("opusplan",
 * "sonnet[1m]"), a coarse alias the CLI handed back ("opus"), or even a raw
 * full model id ("claude-opus-4-1-20250805") forwarded from `system/init`.
 * The CLI's reported model and the selectable list use different granularity,
 * so an exact match alone is too brittle — when it misses we widen the search
 * rather than rendering nothing.
 *
 * Resolution order:
 *  1. exact `value` match — preserves fine-grained user picks
 *  2. alias-equivalence — same model family via `toModelAlias`
 *  3. the `default` item — a sane visible fallback
 *  4. `null` — caller renders a raw label of last resort
 */
export function resolveModelInfo(
  models: ModelInfo[],
  current: string | null | undefined,
): ModelInfo | null {
  if (models.length === 0) return null;
  const target = current ?? DEFAULT_MODEL_ALIAS;

  const exact = models.find((m) => m.value === target);
  if (exact) return exact;

  const targetAlias = toModelAlias(target);
  const aliasMatch = models.find((m) => toModelAlias(m.value) === targetAlias);
  if (aliasMatch) return aliasMatch;

  const defaultItem = models.find((m) => m.value === DEFAULT_MODEL_ALIAS);
  if (defaultItem) return defaultItem;

  return null;
}

/**
 * Whether auto permission mode should be offered for the current model.
 *
 * The CLI gates auto on model, version, plan, provider and admin policy, then
 * surfaces the model dimension as `ModelInfo.supportsAutoMode` (true for
 * supported models, absent/false otherwise — e.g. Haiku). Admin policy is the
 * separate `permissions.disableAutoMode` setting. This is only a *prediction*
 * for whether to show the option; the real applied mode comes from
 * `system/init.permissionMode`.
 */
export function isAutoModeAvailable(
  models: ModelInfo[],
  currentModel: string | null | undefined,
  disableAutoMode: string | undefined,
): boolean {
  if (disableAutoMode === 'disable') return false;
  const info = resolveModelInfo(models, currentModel);
  return info?.supportsAutoMode === true;
}

/**
 * Turn a CLI `/model` echo line into a friendly notice label, or null if the
 * text isn't a model-change line. Accepts both "Set model to <id>" and
 * "Set model to <alias> (<id>)" shapes (and ignores any surrounding tags by
 * matching only from "Set model to" up to the first "(" or a tag/end).
 * The resulting label matches the one our local notification uses, so the two
 * can be deduped by string equality.
 */
export function modelChangeLabel(text: string, models: ModelInfo[]): string | null {
  const match = text.match(/Set model to (.+?)(?:\s*[(<]|$)/);
  if (!match) return null;
  const raw = match[1].trim();
  const info = resolveModelInfo(models, raw);
  return `Set model to ${info ? resolveModelLabel(info) : raw}`;
}
