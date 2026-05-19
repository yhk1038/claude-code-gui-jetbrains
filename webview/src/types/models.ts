/**
 * CLI model alias ("default", "opus", "sonnet", "haiku") used by the
 * Claude Code CLI as the short form of `ModelInfo.value` in the
 * initialize control_response. Full model IDs such as
 * `claude-opus-4-7[1m]` are mapped to one of these aliases via
 * `toModelAlias`.
 */
export const DEFAULT_MODEL_ALIAS = 'default';

export function toModelAlias(value: string | null | undefined): string {
  if (!value) return DEFAULT_MODEL_ALIAS;
  if (value === DEFAULT_MODEL_ALIAS) return DEFAULT_MODEL_ALIAS;
  if (value === 'opus' || value === 'sonnet' || value === 'haiku') return value;
  if (value.includes('opus')) return 'opus';
  if (value.includes('sonnet')) return 'sonnet';
  if (value.includes('haiku')) return 'haiku';
  return DEFAULT_MODEL_ALIAS;
}
