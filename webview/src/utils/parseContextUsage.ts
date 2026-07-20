/**
 * Parser for the `/context` slash-command output.
 *
 * In stream-json mode the CLI returns the context report as a markdown document
 * (header + summary + a "usage by category" table + detail tables) instead of
 * the grid the native terminal TUI paints. We parse that markdown here — in the
 * webview, the final consumer layer — so we can render the grid ourselves. The
 * backend forwards the original markdown verbatim (원본 데이터 보존 원칙).
 *
 * Only the header ("## Context Usage") plus the category table are required; if
 * either is missing we return null so the caller can fall back to plain markdown.
 */

export interface ContextUsageCategory {
  /** Category label exactly as the CLI printed it (e.g. "System prompt"). */
  name: string;
  /** Token count parsed to a plain number (e.g. 2400 for "2.4k"). */
  tokens: number;
  /** Original token label, kept verbatim for display (e.g. "2.4k", "8"). */
  tokensLabel: string;
  /** Percentage of the context window this category occupies (e.g. 0.2). */
  percent: number;
}

export interface ContextUsage {
  /** Model id as printed (e.g. "claude-opus-4-8[1m]"). */
  model: string;
  /** Used-tokens label kept verbatim (e.g. "58.3k"). */
  tokensUsedLabel: string;
  /** Total-window label kept verbatim (e.g. "1m"). */
  tokensTotalLabel: string;
  /** Overall percent of the window used (e.g. 6). */
  percentUsed: number;
  /** One entry per row of the "usage by category" table, including Free space. */
  categories: ContextUsageCategory[];
}

/**
 * Convert a CLI token label to a number.
 *   "2.4k" → 2400 · "941.7k" → 941700 · "10k" → 10000 · "8" → 8 · "1m" → 1000000
 * Returns NaN for anything it can't read.
 */
export function parseTokenValue(label: string): number {
  const match = label.trim().match(/^([\d.,]+)\s*([kmb])?$/i);
  if (!match) return NaN;
  const value = Number(match[1].replace(/,/g, ''));
  if (Number.isNaN(value)) return NaN;
  const unit = match[2]?.toLowerCase();
  const multiplier = unit === 'b' ? 1e9 : unit === 'm' ? 1e6 : unit === 'k' ? 1e3 : 1;
  return Math.round(value * multiplier);
}

/** Parse a "0.2%" style label to a number. Returns NaN when unreadable. */
function parsePercentValue(label: string): number {
  const match = label.trim().match(/^([\d.,]+)\s*%?$/);
  if (!match) return NaN;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isNaN(value) ? NaN : value;
}

/** True for a markdown table separator row (cells made only of dashes/colons). */
function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell.trim()));
}

/** Split a "| a | b | c |" markdown row into trimmed edge-stripped cells. */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return [];
  return trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

const CATEGORY_HEADING = /^#{2,4}\s*Estimated usage by category\s*$/i;

/**
 * Collect the data rows of the category table that follows its heading. Skips the
 * column-header row and the separator row; stops at the first non-table line.
 */
function collectCategoryRows(lines: string[], headingIndex: number): string[][] {
  const rows: string[][] = [];
  let seenHeaderRow = false;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue; // allow a blank gap between heading and table
    if (!line.trim().startsWith('|')) {
      if (rows.length > 0 || seenHeaderRow) break; // table ended
      continue; // heading→table gap may contain stray prose; keep scanning briefly
    }
    const cells = splitTableRow(line);
    if (isSeparatorRow(cells)) continue;
    if (!seenHeaderRow) {
      seenHeaderRow = true; // first non-separator row is the column header
      continue;
    }
    rows.push(cells);
  }
  return rows;
}

export function parseContextUsage(markdown: string): ContextUsage | null {
  if (!markdown || !/^#{1,3}\s*Context Usage\s*$/im.test(markdown)) return null;

  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => CATEGORY_HEADING.test(line));
  if (headingIndex === -1) return null;

  const rows = collectCategoryRows(lines, headingIndex);
  const categories: ContextUsageCategory[] = [];
  for (const cells of rows) {
    if (cells.length < 3) continue;
    const [name, tokensLabel, percentLabel] = cells;
    const tokens = parseTokenValue(tokensLabel);
    const percent = parsePercentValue(percentLabel);
    if (!name || Number.isNaN(tokens)) continue;
    categories.push({
      name,
      tokens,
      tokensLabel,
      percent: Number.isNaN(percent) ? 0 : percent,
    });
  }
  if (categories.length === 0) return null;

  const modelMatch = markdown.match(/\*\*Model:\*\*\s*(.+?)\s*$/im);
  const tokensMatch = markdown.match(
    /\*\*Tokens:\*\*\s*([\d.,]+\s*[kmb]?)\s*\/\s*([\d.,]+\s*[kmb]?)\s*\(\s*([\d.,]+)\s*%\s*\)/im,
  );

  return {
    model: modelMatch ? modelMatch[1].trim() : '',
    tokensUsedLabel: tokensMatch ? tokensMatch[1].trim() : '',
    tokensTotalLabel: tokensMatch ? tokensMatch[2].trim() : '',
    percentUsed: tokensMatch ? parsePercentValue(tokensMatch[3]) : 0,
    categories,
  };
}

/**
 * Slice the detail sections (Custom Agents / Memory Files / Skills …) that follow
 * the category table, returned verbatim so no information is lost. Returns '' when
 * there is nothing after the category table.
 */
export function extractContextDetailMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => CATEGORY_HEADING.test(line));
  if (headingIndex === -1) return '';

  // Walk past the category table, then return everything from the next heading on.
  let i = headingIndex + 1;
  let seenTable = false;
  for (; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('|')) {
      seenTable = true;
      continue;
    }
    if (seenTable && trimmed !== '') break; // first line after the table body
    if (!seenTable && trimmed.startsWith('#')) break; // no table rows at all
  }
  const detailStart = lines.findIndex((line, idx) => idx >= i && /^#{1,4}\s+\S/.test(line));
  if (detailStart === -1) return '';
  return lines.slice(detailStart).join('\n').trim();
}
