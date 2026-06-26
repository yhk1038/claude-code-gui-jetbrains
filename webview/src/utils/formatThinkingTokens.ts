/**
 * Format a live thinking-token estimate for display next to the "Thinking..." label.
 *
 * Mirrors the Claude Code (Cursor/VSCode) extension formatting:
 *   < 1000  → exact count ("575 tokens")
 *   >= 1000 → one-decimal "k" suffix ("1.2k tokens")
 *
 * The estimate comes from the CLI's `{type:"system", subtype:"thinking_tokens"}`
 * stream events (cumulative `estimated_tokens`). Returns null when there is
 * nothing meaningful to show, so callers can omit the suffix entirely.
 */
export function formatThinkingTokens(tokens: number | undefined): string | null {
  if (tokens === undefined || tokens <= 0) return null;
  const count = tokens < 1000 ? String(tokens) : `${(tokens / 1000).toFixed(1)}k`;
  return `${count} tokens`;
}
