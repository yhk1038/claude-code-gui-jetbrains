export interface HighlightSegment {
  text: string;
  matched: boolean;
}

/**
 * Split `text` into alternating matched/unmatched segments for every
 * case-insensitive occurrence of `query`, preserving the original casing.
 * Used to bold the matched portion of a slash command's name/description in
 * the palette (issue #167), mirroring how the CLI highlights matches.
 *
 * An empty or unmatched query yields a single unmatched segment covering the
 * whole string, so callers can render the result uniformly.
 */
export function highlightQuery(text: string, query: string): HighlightSegment[] {
  if (!query) return [{ text, matched: false }];

  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const segments: HighlightSegment[] = [];

  let i = 0;
  while (i < text.length) {
    const idx = haystack.indexOf(needle, i);
    if (idx === -1) {
      segments.push({ text: text.slice(i), matched: false });
      break;
    }
    if (idx > i) segments.push({ text: text.slice(i, idx), matched: false });
    segments.push({ text: text.slice(idx, idx + needle.length), matched: true });
    i = idx + needle.length;
  }

  return segments;
}
