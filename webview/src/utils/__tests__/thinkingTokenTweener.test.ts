import { describe, it, expect } from 'vitest';
import {
  createThinkingTokenTweener,
  TWEEN_FIRST_MS,
  TWEEN_MIN_MS,
  TWEEN_MAX_MS,
} from '../thinkingTokenTweener';

describe('createThinkingTokenTweener', () => {
  it('returns undefined before any target is set', () => {
    const tw = createThinkingTokenTweener();
    expect(tw.valueAt(1000)).toBeUndefined();
  });

  it('eases from 0 to the first target over TWEEN_FIRST_MS', () => {
    const tw = createThinkingTokenTweener();
    tw.update(100, 0);
    expect(tw.valueAt(0)).toBe(0);
    expect(tw.valueAt(TWEEN_FIRST_MS / 2)).toBe(50);
    expect(tw.valueAt(TWEEN_FIRST_MS)).toBe(100);
    // Past the end it stays clamped at the target.
    expect(tw.valueAt(TWEEN_FIRST_MS + 5000)).toBe(100);
  });

  it('floors intermediate values', () => {
    const tw = createThinkingTokenTweener();
    tw.update(100, 0);
    // At 1/3 of the way: 33.33 → floored to 33.
    expect(tw.valueAt(TWEEN_FIRST_MS / 3)).toBe(33);
  });

  it('eases upward to a new target starting from the current interpolated value', () => {
    const tw = createThinkingTokenTweener();
    tw.update(100, 0);
    // Finish the first tween so the current value is exactly 100.
    const t1 = TWEEN_FIRST_MS;
    tw.update(250, t1); // second target arrives; sinceLast = 1200 → clamped within [300,3000]
    expect(tw.valueAt(t1)).toBe(100); // starts from current value
    // Halfway through the second tween (duration = clamp(1200,300,3000) = 1200).
    expect(tw.valueAt(t1 + 600)).toBe(175); // 100 + (250-100)*0.5
    expect(tw.valueAt(t1 + 1200)).toBe(250);
  });

  it('clamps the tween duration between TWEEN_MIN_MS and TWEEN_MAX_MS', () => {
    const tw = createThinkingTokenTweener();
    tw.update(100, 0);
    // A very fast follow-up (sinceLast far below the min) still uses TWEEN_MIN_MS.
    tw.update(200, 10);
    // from = valueAt(10) during the first tween ≈ floor(100*10/1200)=0.
    // duration = clamp(10, 300, 3000) = 300.
    expect(tw.valueAt(10 + TWEEN_MIN_MS)).toBe(200);
    expect(tw.valueAt(10 + TWEEN_MIN_MS - 1)).toBeLessThan(200);
  });

  it('jumps immediately (no easing) when the target decreases', () => {
    const tw = createThinkingTokenTweener();
    tw.update(300, 0);
    tw.update(100, TWEEN_FIRST_MS + 500); // decrease
    expect(tw.valueAt(TWEEN_FIRST_MS + 500)).toBe(100);
  });

  it('is a no-op when the same target is set again', () => {
    const tw = createThinkingTokenTweener();
    tw.update(100, 0);
    const mid = tw.valueAt(600);
    tw.update(100, 600); // same target — must not restart the tween
    expect(tw.valueAt(600)).toBe(mid);
    expect(tw.valueAt(TWEEN_FIRST_MS)).toBe(100);
  });

  it('resets to undefined when the target is cleared', () => {
    const tw = createThinkingTokenTweener();
    tw.update(100, 0);
    tw.update(undefined, 500);
    expect(tw.valueAt(500)).toBeUndefined();
    expect(tw.valueAt(9999)).toBeUndefined();
  });

  it('does not exceed TWEEN_MAX_MS for very sparse updates', () => {
    const tw = createThinkingTokenTweener();
    tw.update(100, 0);
    // Huge gap before the next target.
    tw.update(200, 100_000);
    // duration is capped at TWEEN_MAX_MS, so it completes by then.
    expect(tw.valueAt(100_000 + TWEEN_MAX_MS)).toBe(200);
  });
});
