import { describe, it, expect } from 'vitest';
import {
  clampAutoScrollThreshold,
  isNearBottom,
  AUTO_SCROLL_THRESHOLD_DEFAULT,
  AUTO_SCROLL_THRESHOLD_MAX,
  AUTO_SCROLL_THRESHOLD_MIN,
} from '../autoScroll';

describe('clampAutoScrollThreshold', () => {
  it('keeps in-range values unchanged', () => {
    expect(clampAutoScrollThreshold(80)).toBe(80);
    expect(clampAutoScrollThreshold(200)).toBe(200);
  });

  it('caps absurdly large values (issue #87: user set 20000)', () => {
    expect(clampAutoScrollThreshold(20000)).toBe(AUTO_SCROLL_THRESHOLD_MAX);
  });

  it('floors values below the minimum', () => {
    expect(clampAutoScrollThreshold(0)).toBe(AUTO_SCROLL_THRESHOLD_MIN);
    expect(clampAutoScrollThreshold(-5)).toBe(AUTO_SCROLL_THRESHOLD_MIN);
  });

  it('falls back to the default for non-finite input', () => {
    expect(clampAutoScrollThreshold(NaN)).toBe(AUTO_SCROLL_THRESHOLD_DEFAULT);
    expect(clampAutoScrollThreshold(Infinity)).toBe(AUTO_SCROLL_THRESHOLD_DEFAULT);
  });

  it('rounds fractional values', () => {
    expect(clampAutoScrollThreshold(80.6)).toBe(81);
  });
});

describe('isNearBottom', () => {
  // referenceBottom is the top edge of the sticky input panel.
  // When scrolled to the bottom, the sentinel sits at the panel top.
  it('is true when the sentinel rests at the panel top', () => {
    expect(isNearBottom(500, 500, 80)).toBe(true);
  });

  it('is true while scrolled up within the threshold', () => {
    // scrolled up 50px -> sentinel is 50px below the panel top
    expect(isNearBottom(550, 500, 80)).toBe(true);
  });

  it('is false once scrolled up beyond the threshold', () => {
    expect(isNearBottom(581, 500, 80)).toBe(false);
  });

  it('regression (issue #87): input panel height must not shift the boundary', () => {
    // Anchored to the panel top, only `threshold` governs release —
    // the panel's own height is irrelevant. With the old window.innerHeight
    // basis a tall panel would force the user to scroll panelHeight + threshold.
    const panelTop = 400; // e.g. innerHeight 800 minus a 400px input panel
    expect(isNearBottom(panelTop + 80, panelTop, 80)).toBe(true);
    expect(isNearBottom(panelTop + 81, panelTop, 80)).toBe(false);
  });
});
