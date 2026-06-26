import { describe, it, expect } from 'vitest';
import { formatThinkingTokens } from '../formatThinkingTokens';

describe('formatThinkingTokens', () => {
  it('renders raw count under 1000', () => {
    expect(formatThinkingTokens(575)).toBe('575 tokens');
    expect(formatThinkingTokens(1)).toBe('1 tokens');
    expect(formatThinkingTokens(999)).toBe('999 tokens');
  });

  it('renders thousands with one decimal "k" suffix', () => {
    expect(formatThinkingTokens(1000)).toBe('1.0k tokens');
    expect(formatThinkingTokens(1234)).toBe('1.2k tokens');
    expect(formatThinkingTokens(28800)).toBe('28.8k tokens');
  });

  it('returns null for empty / non-positive values', () => {
    expect(formatThinkingTokens(undefined)).toBeNull();
    expect(formatThinkingTokens(0)).toBeNull();
    expect(formatThinkingTokens(-5)).toBeNull();
  });
});
