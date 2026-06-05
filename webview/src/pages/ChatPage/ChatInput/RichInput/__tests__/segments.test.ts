/**
 * Tests for splitIntoSegments — the pure tokenizer that powers the RichInput
 * mirror overlay. It splits a value into token / plain segments so the mirror
 * can wrap known path tokens (e.g. `src/file.ts#L10-L25`) in highlight chips.
 *
 * Contract:
 *   - left-to-right scan, longest matching token wins at each position
 *   - non-token runs are emitted as plain segments (adjacent plain merged)
 *   - the same token may appear multiple times; every occurrence is a token
 *   - empty token list ⇒ entire value is one plain segment
 */

import { describe, it, expect } from 'vitest';
import { splitIntoSegments } from '../segments';

describe('splitIntoSegments', () => {
  it('returns a single plain segment when there are no tokens', () => {
    expect(splitIntoSegments('hello world', [])).toEqual([
      { text: 'hello world', isToken: false },
    ]);
  });

  it('returns an empty array for an empty value', () => {
    expect(splitIntoSegments('', ['src/file.ts'])).toEqual([]);
  });

  it('marks the whole value as a token when value equals the token', () => {
    expect(splitIntoSegments('src/file.ts', ['src/file.ts'])).toEqual([
      { text: 'src/file.ts', isToken: true },
    ]);
  });

  it('preserves plain text on both sides of a mid-string token', () => {
    expect(
      splitIntoSegments('see src/file.ts now', ['src/file.ts']),
    ).toEqual([
      { text: 'see ', isToken: false },
      { text: 'src/file.ts', isToken: true },
      { text: ' now', isToken: false },
    ]);
  });

  it('handles a token at the start of the value', () => {
    expect(splitIntoSegments('src/file.ts here', ['src/file.ts'])).toEqual([
      { text: 'src/file.ts', isToken: true },
      { text: ' here', isToken: false },
    ]);
  });

  it('handles a token at the end of the value', () => {
    expect(splitIntoSegments('here src/file.ts', ['src/file.ts'])).toEqual([
      { text: 'here ', isToken: false },
      { text: 'src/file.ts', isToken: true },
    ]);
  });

  it('matches every occurrence when a token repeats', () => {
    expect(
      splitIntoSegments('a.ts and a.ts again', ['a.ts']),
    ).toEqual([
      { text: 'a.ts', isToken: true },
      { text: ' and ', isToken: false },
      { text: 'a.ts', isToken: true },
      { text: ' again', isToken: false },
    ]);
  });

  it('matches multiple distinct tokens in one value', () => {
    expect(
      splitIntoSegments('a.ts then b.ts', ['a.ts', 'b.ts']),
    ).toEqual([
      { text: 'a.ts', isToken: true },
      { text: ' then ', isToken: false },
      { text: 'b.ts', isToken: true },
    ]);
  });

  it('prefers the longest token when one is a prefix of another', () => {
    // At position 0 both 'src/file.ts' and 'src/file.ts#L10-L25' start; the
    // longer one must win so the range is not split into chip + plain.
    expect(
      splitIntoSegments('src/file.ts#L10-L25', [
        'src/file.ts',
        'src/file.ts#L10-L25',
      ]),
    ).toEqual([{ text: 'src/file.ts#L10-L25', isToken: true }]);
  });

  it('does not let a shorter token consume part of a longer match', () => {
    expect(
      splitIntoSegments('x src/file.ts#L10-L25 y', [
        'src/file.ts',
        'src/file.ts#L10-L25',
      ]),
    ).toEqual([
      { text: 'x ', isToken: false },
      { text: 'src/file.ts#L10-L25', isToken: true },
      { text: ' y', isToken: false },
    ]);
  });

  it('merges adjacent plain runs around non-matching token candidates', () => {
    // 'file' is not a known token, so the whole string stays plain (one segment).
    expect(splitIntoSegments('this file is fine', ['a.ts'])).toEqual([
      { text: 'this file is fine', isToken: false },
    ]);
  });

  it('ignores empty-string tokens to avoid zero-width loops', () => {
    expect(splitIntoSegments('abc', ['', 'b'])).toEqual([
      { text: 'a', isToken: false },
      { text: 'b', isToken: true },
      { text: 'c', isToken: false },
    ]);
  });

  it('keeps two adjacent tokens as separate token segments', () => {
    expect(splitIntoSegments('a.tsb.ts', ['a.ts', 'b.ts'])).toEqual([
      { text: 'a.ts', isToken: true },
      { text: 'b.ts', isToken: true },
    ]);
  });
});
