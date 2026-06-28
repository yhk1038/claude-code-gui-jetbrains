import { describe, it, expect } from 'vitest';
import {
  EFFORT_AUTO,
  buildEffortLevels,
  getEffortDef,
  nextEffortLevel,
  parseEffortLevel,
  isUltracodeAvailable,
  nextEffortStep,
} from '../effort';

// Mirrors the Claude Code CLI: effort levels are low/medium/high/xhigh (+max
// when a model reports it). "Auto" is not a level — it's the unset state. The
// slider/labels must match the Cursor extension exactly.
const SUPPORTED = ['low', 'medium', 'high', 'xhigh', 'max'];

describe('buildEffortLevels', () => {
  it('does not include an Auto step (Auto is the unset state, not a level)', () => {
    const levels = buildEffortLevels(SUPPORTED);
    expect(levels.map((l) => l.key)).toEqual(SUPPORTED);
    expect(levels.some((l) => l.key === EFFORT_AUTO)).toBe(false);
  });

  it('labels match the Cursor extension (xhigh = "Extra high")', () => {
    const levels = buildEffortLevels(SUPPORTED);
    expect(levels.map((l) => l.label)).toEqual([
      'Low',
      'Medium',
      'High',
      'Extra high',
      'Max',
    ]);
  });
});

describe('getEffortDef', () => {
  it('returns the Auto label for the unset state (null/undefined/auto)', () => {
    for (const v of [null, undefined, EFFORT_AUTO]) {
      expect(getEffortDef(v, SUPPORTED).label).toBe('Auto');
    }
  });

  it('returns the matching level def for a concrete level', () => {
    expect(getEffortDef('xhigh', SUPPORTED).label).toBe('Extra high');
    expect(getEffortDef('low', SUPPORTED).label).toBe('Low');
  });
});

describe('nextEffortLevel', () => {
  it('advances from the unset state to the first level', () => {
    expect(nextEffortLevel(null, SUPPORTED)).toBe('low');
    expect(nextEffortLevel(EFFORT_AUTO, SUPPORTED)).toBe('low');
  });

  it('advances to the adjacent level', () => {
    expect(nextEffortLevel('high', SUPPORTED)).toBe('xhigh');
  });

  it('wraps from the last level back to the first (never returns to Auto)', () => {
    expect(nextEffortLevel('max', SUPPORTED)).toBe('low');
  });

  it('returns null when no levels are supported', () => {
    expect(nextEffortLevel('low', [])).toBeNull();
  });
});

describe('parseEffortLevel', () => {
  it('maps unset / unsupported values to the Auto sentinel', () => {
    expect(parseEffortLevel(null, SUPPORTED)).toBe(EFFORT_AUTO);
    expect(parseEffortLevel('nonsense', SUPPORTED)).toBe(EFFORT_AUTO);
  });

  it('keeps a supported value as-is', () => {
    expect(parseEffortLevel('xhigh', SUPPORTED)).toBe('xhigh');
  });
});

// Ultracode = a synthetic top step above xhigh (xhigh effort + workflows).
// Available only when the model supports xhigh AND workflows aren't disabled.
describe('isUltracodeAvailable', () => {
  it('is available when xhigh is supported and workflows are not disabled', () => {
    expect(isUltracodeAvailable(SUPPORTED, false)).toBe(true);
    expect(isUltracodeAvailable(SUPPORTED, undefined)).toBe(true);
  });

  it('is unavailable when the model has no xhigh level', () => {
    expect(isUltracodeAvailable(['low', 'medium', 'high', 'max'], false)).toBe(false);
  });

  it('is unavailable when workflows are disabled', () => {
    expect(isUltracodeAvailable(SUPPORTED, true)).toBe(false);
  });
});

describe('nextEffortStep', () => {
  it('advances unset → first level', () => {
    expect(nextEffortStep(null, false, SUPPORTED, true)).toEqual({ kind: 'level', key: 'low' });
  });

  it('advances between levels', () => {
    expect(nextEffortStep('high', false, SUPPORTED, true)).toEqual({ kind: 'level', key: 'xhigh' });
  });

  it('advances max → ultracode when ultracode is available', () => {
    expect(nextEffortStep('max', false, SUPPORTED, true)).toEqual({ kind: 'ultracode' });
  });

  it('advances max → first level when ultracode is NOT available', () => {
    expect(nextEffortStep('max', false, SUPPORTED, false)).toEqual({ kind: 'level', key: 'low' });
  });

  it('advances ultracode → first level (wraps back into the level set)', () => {
    expect(nextEffortStep('xhigh', true, SUPPORTED, true)).toEqual({ kind: 'level', key: 'low' });
  });
});
