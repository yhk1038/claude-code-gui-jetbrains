import { describe, it, expect } from 'vitest';
import { highlightQuery } from '../highlightQuery';

describe('highlightQuery', () => {
  it('returns a single unmatched segment when the query is empty', () => {
    expect(highlightQuery('Review PR', '')).toEqual([
      { text: 'Review PR', matched: false },
    ]);
  });

  it('returns a single unmatched segment when there is no match', () => {
    expect(highlightQuery('Review PR', 'zzz')).toEqual([
      { text: 'Review PR', matched: false },
    ]);
  });

  it('splits around a case-insensitive match, preserving original casing', () => {
    expect(highlightQuery('Review PR', 're')).toEqual([
      { text: 'Re', matched: true },
      { text: 'view PR', matched: false },
    ]);
  });

  it('highlights every occurrence of the query', () => {
    // "referee" -> re | fe | re | e
    expect(highlightQuery('referee', 're')).toEqual([
      { text: 're', matched: true },
      { text: 'fe', matched: false },
      { text: 're', matched: true },
      { text: 'e', matched: false },
    ]);
  });

  it('handles a match at the very end', () => {
    expect(highlightQuery('code-review', 'review')).toEqual([
      { text: 'code-', matched: false },
      { text: 'review', matched: true },
    ]);
  });

  it('handles the whole string matching', () => {
    expect(highlightQuery('review', 'REVIEW')).toEqual([
      { text: 'review', matched: true },
    ]);
  });
});
