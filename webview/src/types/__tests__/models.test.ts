import { describe, it, expect } from 'vitest';
import { toModelAlias, resolveModelInfo, modelChangeLabel, DEFAULT_MODEL_ALIAS } from '../models';
import type { ModelInfo } from '../slashCommand';

function model(value: string, displayName = value): ModelInfo {
  return { value, displayName, description: `${displayName} desc` };
}

describe('toModelAlias', () => {
  it('maps full model ids to a coarse alias', () => {
    expect(toModelAlias('claude-opus-4-1-20250805')).toBe('opus');
    expect(toModelAlias('claude-sonnet-4-5-20250929')).toBe('sonnet');
    expect(toModelAlias('claude-haiku-4-5')).toBe('haiku');
  });

  it('passes through short aliases', () => {
    expect(toModelAlias('opus')).toBe('opus');
    expect(toModelAlias('sonnet')).toBe('sonnet');
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

describe('DEFAULT_MODEL_ALIAS', () => {
  it('is "default"', () => {
    expect(DEFAULT_MODEL_ALIAS).toBe('default');
  });
});
