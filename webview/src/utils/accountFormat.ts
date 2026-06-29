/** snake_case plan/subscription tier → Title Case (e.g. "max" → "Max"). */
export function formatPlan(raw: string | null): string | null {
  if (!raw) return null;
  return raw
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Auth method → display label (e.g. "claudeai" → "Claude AI"). */
export function formatAuthMethod(raw: string | null): string | null {
  if (!raw) return null;
  if (raw === 'claudeai') return 'Claude AI';
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}
