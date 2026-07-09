import { describe, it, expect } from 'vitest';
import {
  toModelAlias,
  resolveModelInfo,
  modelChangeLabel,
  isAutoModeAvailable,
  withFableFallback,
  isFablePromoActive,
  resolveCurrentModel,
  FABLE_FALLBACK_MODEL,
  DEFAULT_MODEL_ALIAS,
} from '../models';
import type { ModelInfo } from '../slashCommand';

// A date inside the promo window and one past it, for the Fable fallback tests.
// The window end is FABLE_PROMO_END (2026-07-12, extended from 07-07), so
// AFTER_PROMO must sit past the 12th.
const DURING_PROMO = new Date('2026-07-03T00:00:00Z');
const AFTER_PROMO = new Date('2026-07-13T00:00:00Z');

function model(value: string, displayName = value): ModelInfo {
  return { value, displayName, description: `${displayName} desc` };
}

function modelWithAuto(value: string, supportsAutoMode: boolean): ModelInfo {
  return { value, displayName: value, description: `${value} desc`, supportsAutoMode };
}

describe('isAutoModeAvailable', () => {
  const models = [
    modelWithAuto('default', true),
    modelWithAuto('sonnet', true),
    { value: 'haiku', displayName: 'haiku', description: 'haiku desc' }, // supportsAutoMode absent (false)
  ];

  it('is true when the current model supports auto and policy allows it', () => {
    expect(isAutoModeAvailable(models, 'sonnet', undefined)).toBe(true);
    expect(isAutoModeAvailable(models, 'default', undefined)).toBe(true);
  });

  it('is false when the current model does not support auto', () => {
    expect(isAutoModeAvailable(models, 'haiku', undefined)).toBe(false);
  });

  it('is false when admin policy disables auto mode', () => {
    expect(isAutoModeAvailable(models, 'sonnet', 'disable')).toBe(false);
  });

  it('is false when no model info resolves (empty list)', () => {
    expect(isAutoModeAvailable([], 'sonnet', undefined)).toBe(false);
  });
});

describe('toModelAlias', () => {
  it('maps full model ids to a coarse alias', () => {
    expect(toModelAlias('claude-opus-4-1-20250805')).toBe('opus');
    expect(toModelAlias('claude-sonnet-4-5-20250929')).toBe('sonnet');
    expect(toModelAlias('claude-haiku-4-5')).toBe('haiku');
  });

  it('maps Fable 5 ids and aliases to the "fable" alias', () => {
    expect(toModelAlias('claude-fable-5')).toBe('fable');
    expect(toModelAlias('us.anthropic.claude-fable-5')).toBe('fable');
    expect(toModelAlias('fable')).toBe('fable');
    expect(toModelAlias('fable[1m]')).toBe('fable');
  });

  it('passes through short aliases', () => {
    expect(toModelAlias('opus')).toBe('opus');
    expect(toModelAlias('sonnet')).toBe('sonnet');
    expect(toModelAlias('fable')).toBe('fable');
    expect(toModelAlias('default')).toBe('default');
  });

  it('falls back to default for empty / unknown values', () => {
    expect(toModelAlias(null)).toBe('default');
    expect(toModelAlias(undefined)).toBe('default');
    expect(toModelAlias('')).toBe('default');
    expect(toModelAlias('mystery-model')).toBe('default');
  });
});

describe('resolveModelInfo', () => {
  const opus = model('opus', 'Opus');
  const opusplan = model('opusplan', 'Opus Plan');
  const sonnet = model('sonnet', 'Sonnet');
  const def = model('default', 'Default (recommended)');

  it('returns the exact-match item when value matches', () => {
    const models = [def, sonnet, opus];
    expect(resolveModelInfo(models, 'opus')).toBe(opus);
  });

  it('falls back to alias-equivalence when no exact match exists', () => {
    // current "opus" but only "opusplan" present → both reduce to alias "opus"
    const models = [def, sonnet, opusplan];
    expect(resolveModelInfo(models, 'opus')).toBe(opusplan);
  });

  it('resolves a raw full model id against alias-equivalent list values', () => {
    // systemInit may hand us a full id; it must still resolve
    const models = [def, sonnet, opus];
    expect(resolveModelInfo(models, 'claude-opus-4-1-20250805')).toBe(opus);
  });

  it('falls back to the default item when neither exact nor alias matches', () => {
    // current "opus" with no opus-family item at all → default item
    const models = [def, sonnet];
    expect(resolveModelInfo(models, 'opus')).toBe(def);
  });

  it('returns null only when nothing — not even default — can be resolved', () => {
    const models = [sonnet];
    expect(resolveModelInfo(models, 'opus')).toBeNull();
  });

  it('returns null for an empty model list', () => {
    expect(resolveModelInfo([], 'opus')).toBeNull();
  });

  it('treats a null current as the default alias', () => {
    const models = [def, sonnet, opus];
    expect(resolveModelInfo(models, null)).toBe(def);
  });

  it('does not lose a user-picked fine-grained model to alias collapse', () => {
    // user picked "opusplan"; exact match must win over plain "opus"
    const models = [def, opus, opusplan];
    expect(resolveModelInfo(models, 'opusplan')).toBe(opusplan);
  });
});

describe('modelChangeLabel', () => {
  const models: ModelInfo[] = [
    { value: 'default', displayName: 'Default (recommended)', description: 'Opus 4.8 with 1M context · recommended' },
    { value: 'opus[1m]', displayName: 'Opus', description: 'Opus 4.8 with 1M context · best for hard tasks' },
    { value: 'sonnet', displayName: 'Sonnet', description: 'Sonnet 4.6 · everyday' },
    { value: 'haiku', displayName: 'Haiku', description: 'Haiku 4.5 · fast' },
  ];

  it('parses "Set model to <full id>" into a friendly label', () => {
    // CLI echoes the bare id for the opus[1m] selection
    expect(modelChangeLabel('Set model to claude-opus-4-8[1m]', models)).toBe('Set model to Opus 4.8');
  });

  it('parses "Set model to <alias> (<id>)" by the alias before the paren', () => {
    expect(modelChangeLabel('Set model to sonnet (claude-sonnet-4-6)', models)).toBe('Set model to Sonnet 4.6');
    expect(modelChangeLabel('Set model to haiku (claude-haiku-4-5-20251001)', models)).toBe('Set model to Haiku 4.5');
  });

  it('still parses when wrapped in a local-command-stdout tag', () => {
    expect(
      modelChangeLabel('<local-command-stdout>Set model to claude-opus-4-8[1m]</local-command-stdout>', models),
    ).toBe('Set model to Opus 4.8');
  });

  it('returns null for text that is not a model-change line', () => {
    expect(modelChangeLabel('hello world', models)).toBeNull();
    expect(modelChangeLabel('', models)).toBeNull();
  });

  it('falls back to the raw token when the model is unknown', () => {
    expect(modelChangeLabel('Set model to mystery', [])).toBe('Set model to mystery');
  });
});

describe('isFablePromoActive', () => {
  it('is true inside the promo window (incl. the end day)', () => {
    expect(isFablePromoActive(DURING_PROMO)).toBe(true);
    expect(isFablePromoActive(new Date('2026-07-12T12:00:00Z'))).toBe(true);
  });

  it('is false after the promo window ends', () => {
    expect(isFablePromoActive(AFTER_PROMO)).toBe(false);
  });
});

describe('withFableFallback', () => {
  const def = model('default', 'Default (recommended)');
  const opus = model('opus', 'Opus');
  // A CLI version new enough to select Fable (>= 2.1.170), used wherever the
  // pre-existing expectation is that the fallback gets appended.
  const SUPPORTED_CLI = '2.1.170';

  it('appends the hardcoded Fable item when the list has no Fable model', () => {
    const merged = withFableFallback([def, opus], DURING_PROMO, SUPPORTED_CLI);
    expect(merged).toHaveLength(3);
    expect(merged[2]).toBe(FABLE_FALLBACK_MODEL);
    expect(merged[2].value).toBe('fable');
    expect(merged[2].displayName).toBe('Fable 5');
  });

  it('does not append when a "fable" alias item is already present (dedup)', () => {
    const cliFable = model('fable', 'Fable 5');
    const merged = withFableFallback([def, cliFable], DURING_PROMO, SUPPORTED_CLI);
    expect(merged).toHaveLength(2);
    expect(merged).toEqual([def, cliFable]);
  });

  it('dedups against a full Fable model id the CLI may hand back', () => {
    const cliFable = model('claude-fable-5', 'Fable 5');
    const merged = withFableFallback([def, cliFable], DURING_PROMO, SUPPORTED_CLI);
    expect(merged).toHaveLength(2);
    expect(merged.some((m) => m === FABLE_FALLBACK_MODEL)).toBe(false);
  });

  it('leaves an empty list untouched so "loading" state is preserved', () => {
    // An empty list means the CLI config has not arrived yet; consumers treat
    // length 0 as "loading" (hide the tag / show a spinner). Injecting Fable
    // there would break that, so the fallback only augments a loaded list.
    expect(withFableFallback([], DURING_PROMO, SUPPORTED_CLI)).toEqual([]);
  });

  it('does not inject the fallback after the promo window ends', () => {
    // Past the promo the hardcoded fallback is dropped — nothing to select.
    const merged = withFableFallback([def, opus], AFTER_PROMO, SUPPORTED_CLI);
    expect(merged).toEqual([def, opus]);
  });

  it('still respects a CLI-served Fable entry after the promo (server decides)', () => {
    // If the account's catalog carries Fable, it stays regardless of our promo
    // window — the server, not us, decides post-promo availability.
    const cliFable = model('fable', 'Fable 5');
    const merged = withFableFallback([def, cliFable], AFTER_PROMO, SUPPORTED_CLI);
    expect(merged).toEqual([def, cliFable]);
  });

  it('does not append the fallback when the CLI is too old to select Fable', () => {
    // CLI 2.1.169 < 2.1.170: it doesn't know `--model fable`, so offering the
    // hardcoded fallback would surface a model the user can't actually select.
    const merged = withFableFallback([def, opus], DURING_PROMO, '2.1.169');
    expect(merged).toEqual([def, opus]);
    expect(merged.some((m) => toModelAlias(m.value) === 'fable')).toBe(false);
  });

  it('does not append the fallback when the CLI version is unknown (null)', () => {
    // A null version means we can't confirm Fable support; stay conservative.
    const merged = withFableFallback([def, opus], DURING_PROMO, null);
    expect(merged).toEqual([def, opus]);
  });

  it('appends the fallback when the CLI is exactly at the minimum version', () => {
    // 2.1.170 is the first CLI that knows Fable — inclusive threshold.
    const merged = withFableFallback([def, opus], DURING_PROMO, '2.1.170');
    expect(merged).toHaveLength(3);
    expect(merged[2]).toBe(FABLE_FALLBACK_MODEL);
  });

  it('keeps a CLI-served Fable even on an old CLI (dedup wins over version gate)', () => {
    // If the catalog already carries Fable, that dynamic entry is trusted
    // regardless of the parsed version — the dedup check runs first.
    const cliFable = model('fable', 'Fable 5');
    const merged = withFableFallback([def, cliFable], DURING_PROMO, '2.1.100');
    expect(merged).toEqual([def, cliFable]);
  });
});

describe('resolveCurrentModel', () => {
  it('prefers the running session model (systemInit truth)', () => {
    // Even if settings say fable, the actually-running model wins once known.
    expect(resolveCurrentModel('opus', 'fable')).toBe('opus');
  });

  it('falls back to the settings model before send (new session prediction)', () => {
    // No CLI spawned yet (sessionModel null) → show the user's default choice.
    expect(resolveCurrentModel(null, 'fable')).toBe('fable');
  });

  it('falls back to the default alias when neither is set', () => {
    expect(resolveCurrentModel(null, null)).toBe(DEFAULT_MODEL_ALIAS);
    expect(resolveCurrentModel(undefined, undefined)).toBe(DEFAULT_MODEL_ALIAS);
  });
});

describe('DEFAULT_MODEL_ALIAS', () => {
  it('is "default"', () => {
    expect(DEFAULT_MODEL_ALIAS).toBe('default');
  });
});
